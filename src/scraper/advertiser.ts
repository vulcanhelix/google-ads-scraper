import { Page } from 'playwright';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';
import { URLS } from '../config';

export interface AdvertiserInfo {
  id: string;
  name: string;
  verificationStatus: string;
  location?: string;
}

export interface AdvertiserLookupResult {
  success: boolean;
  advertiser?: AdvertiserInfo;
  error?: string;
  alternatives?: AdvertiserInfo[];
}

export async function lookupAdvertiserByDomain(
  page: Page,
  domain: string
): Promise<AdvertiserLookupResult> {
  try {
    logger.info(`Looking up advertiser for domain: ${domain}`);

    // Navigate to the transparency center with US region for better results
    const startUrl = `${URLS.BASE}/?region=US`;
    await page.goto(startUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await delay(2000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await delay(1000);

    // Find the search input
    logger.info('Finding search input...');
    const searchInput = await page.$('input[type="text"], input[type="search"], input');
    
    if (!searchInput) {
      return {
        success: false,
        error: 'Could not find search input on page',
      };
    }

    // Click and type the domain
    await searchInput.click();
    await delay(500);
    
    // Clear any existing text
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await delay(300);
    
    // Type the domain slowly to trigger autocomplete
    logger.info(`Typing search term: ${domain}`);
    await page.keyboard.type(domain, { delay: 100 });
    
    // Wait for the autocomplete dropdown to appear
    logger.info('Waiting for autocomplete dropdown...');
    await delay(2500);

    // Try to find and click on the domain in the dropdown
    // Look for elements containing the domain text
    const dropdownSelectors = [
      `text="${domain}"`,
      `[role="option"]:has-text("${domain}")`,
      `[role="listbox"] >> text="${domain}"`,
      `a:has-text("${domain}")`,
      `div:has-text("${domain}"):not(:has(div:has-text("${domain}")))`,
    ];

    let clicked = false;
    for (const selector of dropdownSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          // Check if this element is in the visible dropdown
          const isVisible = await element.isVisible();
          if (isVisible) {
            logger.info(`Found dropdown item, clicking: ${selector}`);
            await element.click();
            clicked = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!clicked) {
      // Try clicking any link/button in the autocomplete area
      logger.info('Trying to click first autocomplete result...');
      
      // Look for the dropdown container and click the first result
      const dropdownItems = await page.$$('[role="option"], [role="listitem"], .suggestion-item');
      
      if (dropdownItems.length > 0) {
        logger.info(`Found ${dropdownItems.length} dropdown items`);
        // Find one that contains our domain
        for (const item of dropdownItems) {
          const text = await item.textContent();
          if (text?.toLowerCase().includes(domain.toLowerCase().replace('.com', ''))) {
            await item.click();
            clicked = true;
            logger.info(`Clicked item: ${text?.substring(0, 50)}`);
            break;
          }
        }
        
        // If no domain match, click the first one
        if (!clicked && dropdownItems.length > 0) {
          await dropdownItems[0].click();
          clicked = true;
          logger.info('Clicked first dropdown item');
        }
      }
    }

    if (!clicked) {
      // Last resort: try using keyboard navigation
      logger.info('Using keyboard to select from dropdown...');
      await page.keyboard.press('ArrowDown');
      await delay(300);
      await page.keyboard.press('Enter');
    }

    // Wait for navigation
    await delay(3000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await delay(2000);

    // Check if we landed on an advertiser page
    const currentUrl = page.url();
    logger.info(`Current URL: ${currentUrl}`);
    
    const directMatch = currentUrl.match(/\/advertiser\/(AR\d+)/);
    if (directMatch) {
      const advertiserId = directMatch[1];
      const advertiserName = await extractAdvertiserName(page);
      const verificationStatus = await extractVerificationStatus(page);

      logger.info(`Found advertiser: ${advertiserName} (${advertiserId})`);
      return {
        success: true,
        advertiser: {
          id: advertiserId,
          name: advertiserName,
          verificationStatus,
        },
      };
    }

    // Check for advertiser ID in URL params
    const urlParams = new URL(currentUrl).searchParams;
    const advertiserIdParam = urlParams.get('advertiser_id');
    if (advertiserIdParam) {
      await page.goto(`${URLS.ADVERTISER}${advertiserIdParam}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await delay(3000);
      
      const advertiserName = await extractAdvertiserName(page);
      return {
        success: true,
        advertiser: {
          id: advertiserIdParam,
          name: advertiserName,
          verificationStatus: 'UNKNOWN',
        },
      };
    }

    // Search for advertiser IDs in page content
    const pageContent = await page.content();
    const arMatches = pageContent.match(/AR\d{17,20}/g);
    
    if (arMatches && arMatches.length > 0) {
      const uniqueIds = [...new Set(arMatches)];
      logger.info(`Found ${uniqueIds.length} advertiser ID(s) in page`);

      const advertiserId = uniqueIds[0];
      await page.goto(`${URLS.ADVERTISER}${advertiserId}?region=anywhere`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      await delay(3000);
      await page.waitForLoadState('networkidle').catch(() => {});

      const advertiserName = await extractAdvertiserName(page);
      const verificationStatus = await extractVerificationStatus(page);

      const alternatives = uniqueIds.slice(1, 6).map((id) => ({
        id,
        name: '',
        verificationStatus: 'UNKNOWN',
      }));

      return {
        success: true,
        advertiser: {
          id: advertiserId,
          name: advertiserName,
          verificationStatus,
        },
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      };
    }

    // Debug: save screenshot
    const screenshotPath = `./data/debug-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    logger.info(`Debug screenshot saved to: ${screenshotPath}`);

    return {
      success: false,
      error: `No advertisers found for domain: ${domain}. Try with --no-headless to debug.`,
    };
  } catch (error) {
    logger.error('Advertiser lookup failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractAdvertiserName(page: Page): Promise<string> {
  await delay(1000);
  
  // First try getting from page title (most reliable)
  const title = await page.title();
  if (title) {
    // Title format: "Advertiser Name - Ads Transparency Center"
    const parts = title.split(/\s*[-|–]\s*/);
    if (parts.length > 1) {
      const name = parts[0].trim();
      if (
        name &&
        name.length > 1 &&
        !name.toLowerCase().includes('ads transparency') &&
        !name.toLowerCase().includes('google')
      ) {
        return name;
      }
    }
  }
  
  // Try various heading selectors
  const selectors = [
    'h1',
    '[data-advertiser-name]',
    '[role="heading"][aria-level="1"]',
    'main h1',
    'header h1',
  ];

  for (const selector of selectors) {
    try {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const text = await element.textContent();
        if (text) {
          const cleaned = text.trim().replace(/\s+/g, ' ');
          if (
            cleaned.length > 1 &&
            cleaned.length < 150 &&
            !cleaned.toLowerCase().includes('ads transparency') &&
            !cleaned.toLowerCase().includes('google ads') &&
            !cleaned.toLowerCase().includes('sign in') &&
            !cleaned.match(/^\d+\s*ads?$/i)
          ) {
            return cleaned;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return 'Unknown Advertiser';
}

async function extractVerificationStatus(page: Page): Promise<string> {
  try {
    const pageText = (await page.textContent('body')) || '';
    const lowerText = pageText.toLowerCase();
    
    if (
      lowerText.includes('identity verified') ||
      lowerText.includes('verified advertiser')
    ) {
      return 'VERIFIED';
    }
  } catch {
    // Ignore
  }

  return 'NOT_VERIFIED';
}
