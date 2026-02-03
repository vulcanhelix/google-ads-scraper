import { Page } from 'playwright';
import { AdCreative, AdFormat, ScrapeFilters } from '../types';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';
import { URLS } from '../config';

export interface AdScrapeResult {
  success: boolean;
  ads: AdCreative[];
  totalFound: number;
  errors: string[];
}

export async function scrapeAdvertiserAds(
  page: Page,
  advertiserId: string,
  filters?: ScrapeFilters
): Promise<AdScrapeResult> {
  const ads: AdCreative[] = [];
  const errors: string[] = [];

  try {
    logger.info(`Scraping ads for advertiser: ${advertiserId}`);

    let url = `${URLS.ADVERTISER}${advertiserId}`;
    const params = new URLSearchParams();

    if (filters?.region) {
      params.set('region', filters.region);
    }
    if (filters?.platform) {
      params.set('platform', filters.platform);
    }
    if (filters?.format) {
      params.set('format', filters.format);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    // Wait for page to stabilize
    await delay(3000);
    await page.waitForLoadState('networkidle').catch(() => {});

    await waitForAdsToLoad(page);

    const totalCount = await extractTotalAdCount(page);
    logger.info(`Total ads reported: ${totalCount || 'unknown'}`);

    let previousAdCount = 0;
    let noNewAdsCount = 0;
    const maxNoNewAds = 8;
    let scrollAttempts = 0;
    const maxScrollAttempts = 150;

    while (scrollAttempts < maxScrollAttempts) {
      scrollAttempts++;

      const currentAds = await extractVisibleAds(page, advertiserId);

      for (const ad of currentAds) {
        if (!ads.find((a) => a.id === ad.id)) {
          ads.push(ad);
        }
      }

      if (ads.length !== previousAdCount) {
        logger.info(`Collected ${ads.length} unique ads so far`);
      }

      if (filters?.maxResults && ads.length >= filters.maxResults) {
        logger.info(`Reached max results limit: ${filters.maxResults}`);
        break;
      }

      if (ads.length === previousAdCount) {
        noNewAdsCount++;
        if (noNewAdsCount >= maxNoNewAds) {
          logger.info('No new ads found after scrolling. Finishing.');
          break;
        }
      } else {
        noNewAdsCount = 0;
        previousAdCount = ads.length;
      }

      // Scroll down incrementally
      await page.evaluate(() => {
        window.scrollBy(0, 800);
      });
      await delay(1000);

      // Check if we can scroll more
      const scrollInfo = await page.evaluate(() => ({
        scrollTop: window.scrollY,
        scrollHeight: document.body.scrollHeight,
        clientHeight: window.innerHeight,
      }));

      const atBottom = scrollInfo.scrollTop + scrollInfo.clientHeight >= scrollInfo.scrollHeight - 100;
      
      if (atBottom) {
        // Wait for potential lazy loading
        await delay(2000);
        
        // Check again after wait
        const newScrollHeight = await page.evaluate(() => document.body.scrollHeight);
        if (newScrollHeight === scrollInfo.scrollHeight) {
          // Try one more scroll to trigger loading
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await delay(2000);
          
          const finalHeight = await page.evaluate(() => document.body.scrollHeight);
          if (finalHeight === scrollInfo.scrollHeight) {
            logger.info('Reached end of ads list');
            break;
          }
        }
      }
    }

    return {
      success: true,
      ads: filters?.maxResults ? ads.slice(0, filters.maxResults) : ads,
      totalFound: totalCount || ads.length,
      errors,
    };
  } catch (error) {
    logger.error('Ad scraping failed:', error);
    return {
      success: false,
      ads,
      totalFound: ads.length,
      errors: [
        ...errors,
        error instanceof Error ? error.message : 'Unknown error',
      ],
    };
  }
}

async function waitForAdsToLoad(page: Page): Promise<void> {
  const adContainerSelectors = [
    '[data-creative-id]',
    'creative-card',
    '[role="listitem"]',
    '.ad-card',
    '[data-ad-id]',
    'a[href*="/creative/CR"]',
  ];

  for (const selector of adContainerSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      logger.debug(`Found ads using selector: ${selector}`);
      return;
    } catch {
      continue;
    }
  }

  await page.waitForLoadState('networkidle');
  await delay(3000);
}

async function extractTotalAdCount(page: Page): Promise<number | null> {
  try {
    const pageText = (await page.textContent('body')) || '';

    const countPatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*ads?\b/i,
      /showing\s*(\d{1,3}(?:,\d{3})*)/i,
      /(\d{1,3}(?:,\d{3})*)\s*results?\b/i,
      /(\d{1,3}(?:,\d{3})*)\s*creatives?\b/i,
    ];

    for (const pattern of countPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

async function extractVisibleAds(
  page: Page,
  advertiserId: string
): Promise<AdCreative[]> {
  return await page.evaluate((advId) => {
    const ads: AdCreative[] = [];
    const seenIds = new Set<string>();

    const creativeLinks = document.querySelectorAll('a[href*="/creative/CR"]');

    creativeLinks.forEach((link) => {
      try {
        const href = link.getAttribute('href') || '';
        const creativeMatch = href.match(/CR\d+/);
        if (!creativeMatch) return;

        const creativeId = creativeMatch[0];
        if (seenIds.has(creativeId)) return;
        seenIds.add(creativeId);

        const card =
          link.closest('[role="listitem"]') ||
          link.closest('div[class]') ||
          link.parentElement?.parentElement;

        let format: AdFormat = 'text';
        if (card) {
          if (card.querySelector('video')) format = 'video';
          else if (card.querySelector('img:not([role="presentation"])'))
            format = 'image';
        }

        const text = card?.textContent || '';
        const dateMatch = text.match(
          /(\w+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/g
        );

        ads.push({
          id: creativeId,
          advertiserId: advId,
          format: format,
          platforms: ['unknown'],
          firstShown: dateMatch?.[0] || '',
          lastShown: dateMatch?.[1] || dateMatch?.[0] || '',
          totalDaysShown: 0,
          detailsUrl: `https://adstransparency.google.com${href}`,
          regionStats: [],
        });
      } catch {
        // Skip malformed elements
      }
    });

    if (ads.length === 0) {
      const allLinks = document.querySelectorAll('a[href*="adstransparency"]');
      allLinks.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/CR\d+/);
        if (match && !seenIds.has(match[0])) {
          seenIds.add(match[0]);
          ads.push({
            id: match[0],
            advertiserId: advId,
            format: 'text',
            platforms: ['unknown'],
            firstShown: '',
            lastShown: '',
            totalDaysShown: 0,
            detailsUrl: href.startsWith('http')
              ? href
              : `https://adstransparency.google.com${href}`,
            regionStats: [],
          });
        }
      });
    }

    return ads;
  }, advertiserId) as AdCreative[];
}

async function scrollForMore(page: Page): Promise<boolean> {
  const previousScrollHeight = await page.evaluate(
    () => document.body.scrollHeight
  );

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });

  await delay(1000);

  const newScrollHeight = await page.evaluate(
    () => document.body.scrollHeight
  );

  return newScrollHeight > previousScrollHeight;
}
