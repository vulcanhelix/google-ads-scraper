import { Page } from 'playwright';
import { AdCreative, AdFormat, AdPlatform, ScrapeFilters } from '../types';
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

    logger.info(`Collected ${ads.length} ads from list page`);
    
    // Extract detailed information for each ad
    logger.info('Extracting detailed information for each ad...');
    const enrichedAds: AdCreative[] = [];
    
    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      logger.info(`Processing ad ${i + 1}/${ads.length}: ${ad.id}`);
      
      try {
        const enrichedAd = await extractAdDetails(page, ad);
        enrichedAds.push(enrichedAd);
        
        // Small delay between detail extractions to avoid rate limiting
        if (i < ads.length - 1) {
          await delay(1500);
        }
      } catch (error) {
        logger.error(`Failed to enrich ad ${ad.id}, using basic data:`, error);
        enrichedAds.push(ad);
        errors.push(`Failed to extract details for ad ${ad.id}`);
      }
    }

    return {
      success: true,
      ads: filters?.maxResults ? enrichedAds.slice(0, filters.maxResults) : enrichedAds,
      totalFound: totalCount || enrichedAds.length,
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

/**
 * Extract detailed information from an individual ad's detail page
 */
async function extractAdDetails(
  page: Page,
  ad: AdCreative
): Promise<AdCreative> {
  try {
    logger.info(`Extracting details for ad: ${ad.id}`);
    
    // Navigate to the ad detail page
    await page.goto(ad.detailsUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    await delay(2000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await delay(1000);

    // Extract headline from page title or main heading
    const headline = await extractHeadline(page);
    
    // Extract description
    const description = await extractDescription(page);
    
    // Extract image URL
    const imageUrl = ad.format === 'image' ? await extractImageUrl(page) : null;
    
    // Extract video URL
    const videoUrl = ad.format === 'video' ? await extractVideoUrl(page) : null;
    
    // Extract platforms
    const platforms = await extractPlatforms(page);
    
    // Extract dates
    const { firstShown, lastShown, daysShown } = await extractDates(page);
    
    // Extract region stats
    const regionStats = await extractRegionStats(page);
    
    // Extract target domain
    const targetDomain = await extractTargetDomain(page);

    return {
      ...ad,
      headline: headline || ad.headline,
      description: description || ad.description,
      imageUrl: imageUrl || ad.imageUrl,
      videoUrl: videoUrl || ad.videoUrl,
      platforms: platforms.length > 0 ? platforms : ad.platforms,
      firstShown: firstShown || ad.firstShown,
      lastShown: lastShown || ad.lastShown,
      totalDaysShown: daysShown || ad.totalDaysShown,
      regionStats: regionStats.length > 0 ? regionStats : ad.regionStats,
      targetDomain: targetDomain || ad.targetDomain,
    };
  } catch (error) {
    logger.error(`Failed to extract details for ad ${ad.id}:`, error);
    return ad; // Return original ad if extraction fails
  }
}

async function extractHeadline(page: Page): Promise<string | null> {
  try {
    // Google renders ad content as images, so we can't extract text headlines
    // Instead, try to get the page title which sometimes contains the ad headline
    const title = await page.title();
    if (title && !title.includes('Google Ads Transparency Center') && !title.includes('Creative')) {
      return title;
    }

    // For text ads, the headline might be in the advertiser title
    const advertiserTitle = await page.textContent('a.advertiser-title').catch(() => null);
    if (advertiserTitle) {
      return advertiserTitle;
    }
  } catch (error) {
    logger.error('Error extracting headline:', error);
  }
  return null;
}

async function extractDescription(page: Page): Promise<string | null> {
  try {
    // Google renders ad descriptions as part of the preview image
    // We cannot extract text descriptions from images
    // Return null as this data is not available as text
    return null;
  } catch (error) {
    logger.error('Error extracting description:', error);
  }
  return null;
}

async function extractImageUrl(page: Page): Promise<string | null> {
  try {
    // Google renders ad previews inside html-renderer or fletch-renderer elements
    // The actual ad content (including text ads) is rendered as an image
    const rendererSelectors = ['html-renderer img', 'fletch-renderer img'];
    
    for (const selector of rendererSelectors) {
      const img = await page.$(selector);
      if (img) {
        const src = await img.getAttribute('src');
        if (src) {
          return src.startsWith('//') ? `https:${src}` : src;
        }
      }
    }

    // Fallback: look for any large image
    const images = await page.$$('img:not([role="presentation"])');
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        const width = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
        const height = await img.evaluate((el) => (el as HTMLImageElement).naturalHeight);
        if (width > 100 && height > 100) {
          return src.startsWith('//') ? `https:${src}` : src;
        }
      }
    }
  } catch (error) {
    logger.error('Error extracting image URL:', error);
  }
  return null;
}

async function extractVideoUrl(page: Page): Promise<string | null> {
  try {
    const video = await page.$('video');
    if (video) {
      const src = await video.getAttribute('src');
      if (src) {
        return src.startsWith('//') ? `https:${src}` : src;
      }
      
      // Try source elements
      const source = await video.$('source');
      if (source) {
        const sourceSrc = await source.getAttribute('src');
        if (sourceSrc) {
          return sourceSrc.startsWith('//') ? `https:${sourceSrc}` : sourceSrc;
        }
      }
    }
  } catch (error) {
    logger.error('Error extracting video URL:', error);
  }
  return null;
}

async function extractPlatforms(page: Page): Promise<AdPlatform[]> {
  try {
    // Platform information is not consistently shown on Google Ads detail pages
    // Return 'unknown' as this data is often not available
    return ['unknown'];
  } catch (error) {
    logger.error('Error extracting platforms:', error);
    return ['unknown'];
  }
}

async function extractDates(page: Page): Promise<{ firstShown: string; lastShown: string; daysShown: number }> {
  try {
    const dateInfo = { firstShown: '', lastShown: '', daysShown: 0 };

    // Extract "Last shown" from .property.last-shown
    const lastShownText = await page.textContent('.property.last-shown').catch(() => null);
    if (lastShownText) {
      // Remove the "Last shown" label and get just the date
      const dateMatch = lastShownText.replace(/Last shown/i, '').trim();
      if (dateMatch) {
        dateInfo.lastShown = dateMatch;
      }
    }

    // Google Ads Transparency Center often doesn't show "First shown" date
    // It's not consistently available, so we leave it empty

    return dateInfo;
  } catch (error) {
    logger.error('Error extracting dates:', error);
  }
  return { firstShown: '', lastShown: '', daysShown: 0 };
}

async function extractRegionStats(page: Page): Promise<any[]> {
  try {
    // This would require more complex parsing of region data
    // For now, return empty array
    // TODO: Implement region stats extraction if available on detail page
    return [];
  } catch (error) {
    logger.error('Error extracting region stats:', error);
    return [];
  }
}

async function extractTargetDomain(page: Page): Promise<string | null> {
  try {
    // Look for links in the ad that might be the target domain
    const links = await page.$$('a[href^="http"]');
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href) {
        try {
          const url = new URL(href);
          // Skip Google domains
          if (!url.hostname.includes('google.com') && 
              !url.hostname.includes('doubleclick.net')) {
            return url.hostname;
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    logger.error('Error extracting target domain:', error);
  }
  return null;
}

