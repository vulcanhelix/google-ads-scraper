import { Page } from 'playwright';
import { Actor } from 'apify';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';
import { URLS } from '../config';
import { ApiInterceptor } from './api-interceptor';

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

    const interceptor = new ApiInterceptor();
    interceptor.attach(page);

    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,eot}', (route) => route.abort());

    const url = `${URLS.BASE}/?region=US&domain=${encodeURIComponent(domain)}`;
    
    logger.info(`Navigating to: ${url}`);
    
    let navigated = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!navigated && attempts < maxAttempts) {
      attempts++;
      try {
        logger.info(`Navigation attempt ${attempts}/${maxAttempts}...`);
        
        await page.goto(url, {
          waitUntil: 'commit',
          timeout: 45000,
        });
        
        logger.info('Connected, waiting for response...');
        
        await Promise.race([
          page.waitForResponse(
            (r) => r.url().includes('SearchService/SearchCreatives'),
            { timeout: 30000 }
          ).catch(() => null),
          delay(30000),
        ]);
        
        navigated = true;
      } catch (e) {
        logger.warn(`Navigation attempt ${attempts} failed: ${e}`);
        if (attempts === maxAttempts) throw e;
        await delay(3000);
      }
    }

    await delay(2000);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await delay(1000);

    const creatives = interceptor.getCreatives();
    logger.info(`API interceptor captured ${creatives.length} creatives`);
    
    if (creatives.length > 0) {
      const uniqueAdvertisers = new Map<string, { name: string; count: number }>();
      
      for (const c of creatives) {
        const existing = uniqueAdvertisers.get(c.advertiserId);
        if (existing) {
          existing.count++;
        } else {
          uniqueAdvertisers.set(c.advertiserId, { name: c.advertiserName, count: 1 });
        }
      }

      logger.info(`Found ${uniqueAdvertisers.size} unique advertiser(s) from API`);

      // Pick the best advertiser: prefer name matching the domain, then highest ad count
      const domainBase = domain.replace(/\.(com|org|net|io|co|ai|dev)$/i, '').toLowerCase();
      let bestId = '';
      let bestName = '';
      let bestScore = -1;

      for (const [id, info] of uniqueAdvertisers.entries()) {
        const nameLower = info.name.toLowerCase();
        let score = info.count;
        // Strong boost if the advertiser name contains the domain name
        if (nameLower.includes(domainBase)) {
          score += 10000;
        }
        if (score > bestScore) {
          bestScore = score;
          bestId = id;
          bestName = info.name;
        }
      }

      logger.info(`Primary advertiser: ${bestName} (${bestId})`);

      const alternatives: AdvertiserInfo[] = [];
      for (const [id, info] of uniqueAdvertisers.entries()) {
        if (id !== bestId) {
          alternatives.push({
            id,
            name: info.name,
            verificationStatus: 'UNKNOWN',
          });
        }
      }

      return {
        success: true,
        advertiser: {
          id: bestId,
          name: bestName,
          verificationStatus: 'UNKNOWN',
        },
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      };
    }

    const currentUrl = page.url();
    logger.info(`Current URL: ${currentUrl}`);
    
    const match = currentUrl.match(/\/advertiser\/(AR\d+)/);
    if (match) {
      const advertiserId = match[1];
      const advertiserName = await extractAdvertiserName(page);
      const verificationStatus = await extractVerificationStatus(page);

      logger.info(`Found advertiser from URL: ${advertiserName} (${advertiserId})`);
      return {
        success: true,
        advertiser: {
          id: advertiserId,
          name: advertiserName,
          verificationStatus,
        },
      };
    }

    const pageContent = await page.content();
    const arMatches = pageContent.match(/AR\d{17,20}/g);
    
    if (arMatches && arMatches.length > 0) {
      const uniqueIds = [...new Set(arMatches)];
      logger.info(`Found ${uniqueIds.length} advertiser ID(s) in page content`);

      const advertiserId = uniqueIds[0];
      await page.goto(`${URLS.ADVERTISER}${advertiserId}?region=anywhere`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      await delay(2000);

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

    return {
      success: false,
      error: `No advertisers found for domain: ${domain}. The domain may not have any Google ads.`,
    };
  } catch (error) {
    logger.error('Advertiser lookup failed:', error);

    try {
      const timestamp = Date.now();
      const screenshotKey = `ERROR_SCREENSHOT_${timestamp}`;
      
      const screenshotBuffer = await page.screenshot({ 
        fullPage: false,
        timeout: 5000 
      });
      await Actor.setValue(screenshotKey, screenshotBuffer, { contentType: 'image/png' });
      
      logger.info(`Error screenshot saved to Key-Value Store as: ${screenshotKey}`);
      
      const title = await page.title();
      const url = page.url();
      logger.error(`Error State - Title: "${title}", URL: "${url}"`);
      
    } catch (snapshotError) {
      logger.error('Failed to capture error snapshot:', snapshotError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractAdvertiserName(page: Page): Promise<string> {
  await delay(1000);
  
  const title = await page.title();
  if (title) {
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
  }

  return 'NOT_VERIFIED';
}
