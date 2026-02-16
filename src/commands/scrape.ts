import { createBrowser, createContext, createPage } from '../scraper/browser';
import { lookupAdvertiserByDomain } from '../scraper/advertiser';
import { scrapeAdvertiserAds } from '../scraper/ads';
import {
  upsertAdvertiser,
  upsertAdCreatives,
  getAdvertiserByDomain,
  getAdsByAdvertiser,
  startScrapeSession,
  completeScrapeSession,
} from '../database/repository';
import { exportToJson, exportToCsv } from '../export';
import { ScrapeFilters, Advertiser, ScrapeResult, AdFormat, AdPlatform } from '../types';
import { logger } from '../utils/logger';

interface ScrapeOptions {
  region?: string;
  format?: string;
  platform?: string;
  max?: number;
  headless: boolean;
  output: 'json' | 'csv' | 'both';
  outputDir: string;
}

export async function scrape(domain: string, options: ScrapeOptions): Promise<void> {
  // Short cache to avoid re-scraping on accidental double-clicks (1 hour)
  const cacheWindowMs = 1 * 60 * 60 * 1000;
  const now = Date.now();

  // Default to 20, allow up to 100
  if (!options.max) {
    options.max = 20;
  } else if (options.max > 100) {
    options.max = 100;
    logger.info('Max results capped at 100');
  }

  logger.info(`Starting scrape for domain: ${domain}`);
  logger.info(`Options: ${JSON.stringify(options)}`);

  const cachedAdvertiser = await getAdvertiserByDomain(domain);
  if (cachedAdvertiser?.lastScrapedAt) {
    const lastScrapedAt = cachedAdvertiser.lastScrapedAt.getTime();
    const isFresh = now - lastScrapedAt < cacheWindowMs;
    if (isFresh) {
      const cachedAds = await getAdsByAdvertiser(cachedAdvertiser.id);
      if (cachedAds.length > 0) {
        logger.info(
          `Using cached ads from ${cachedAdvertiser.lastScrapedAt.toISOString()} (within 21 days)`
        );

        const mappedAds = cachedAds.map((ad) => ({
          id: ad.id,
          advertiserId: ad.advertiserId,
          format: ad.format as AdFormat,
          platforms: ad.platforms as AdPlatform[],
          targetDomain: ad.targetDomain || undefined,
          firstShown: ad.firstShown || '',
          lastShown: ad.lastShown || '',
          totalDaysShown: ad.totalDaysShown || 0,
          detailsUrl: ad.detailsUrl,
          previewUrl: ad.previewUrl || undefined,
          regionStats: (ad.regionStats as any) || [],
          headline: ad.headline || undefined,
          description: ad.description || undefined,
          headlineConfidence: ad.headlineConfidence || undefined,
          descriptionConfidence: ad.descriptionConfidence || undefined,
          imageUrl: ad.imageUrl || undefined,
          videoUrl: ad.videoUrl || undefined,
        }));

        const exportData: ScrapeResult = {
          success: true,
          advertiser: {
            id: cachedAdvertiser.id,
            name: cachedAdvertiser.name,
            verificationStatus: cachedAdvertiser.verificationStatus,
            location: cachedAdvertiser.location || undefined,
            domain: cachedAdvertiser.domain || undefined,
            lastScrapedAt: cachedAdvertiser.lastScrapedAt.toISOString(),
            lastTotalAdsFound: cachedAdvertiser.lastTotalAdsFound || undefined,
            lastScrapeRegion: cachedAdvertiser.lastScrapeRegion || undefined,
            lastOcrRunAt: cachedAdvertiser.lastOcrRunAt
              ? cachedAdvertiser.lastOcrRunAt.toISOString()
              : undefined,
          },
          ads: mappedAds,
          totalAdsFound: mappedAds.length,
          scrapedAt: cachedAdvertiser.lastScrapedAt.toISOString(),
        };

        if (options.output === 'json' || options.output === 'both') {
          await exportToJson(exportData, options.outputDir, domain);
        }

        if (options.output === 'csv' || options.output === 'both') {
          await exportToCsv(exportData, options.outputDir, domain);
        }

        return;
      }
    }
  }

  const browser = await createBrowser({ headless: options.headless });
  const context = await createContext(browser, { headless: options.headless });
  const page = await createPage(context);

  let sessionId: number | null = null;

  try {
    logger.info('Step 1: Looking up advertiser...');
    const lookupResult = await lookupAdvertiserByDomain(page, domain);

    if (!lookupResult.success || !lookupResult.advertiser) {
      throw new Error(lookupResult.error || 'Advertiser not found');
    }

    const advertiser: Advertiser = {
      ...lookupResult.advertiser,
      domain,
    };

    logger.info(`Found advertiser: ${advertiser.name} (${advertiser.id})`);

    if (lookupResult.alternatives && lookupResult.alternatives.length > 0) {
      logger.info(
        `Also found ${lookupResult.alternatives.length} alternative matches:`
      );
      lookupResult.alternatives.forEach((alt) => {
        logger.info(`  - ${alt.name} (${alt.id})`);
      });
    }

    await upsertAdvertiser(advertiser);

    sessionId = await startScrapeSession(advertiser.id);

    logger.info('Step 2: Scraping ads...');

    const filters: ScrapeFilters = {
      region: options.region,
      format: options.format as AdFormat | undefined,
      platform: options.platform as AdPlatform | undefined,
      maxResults: options.max,
      extractHeadlines: true,
    };

    const scrapeResult = await scrapeAdvertiserAds(page, advertiser.id, filters);

    if (!scrapeResult.success && scrapeResult.ads.length === 0) {
      throw new Error(scrapeResult.errors.join(', ') || 'Scraping failed');
    }

    logger.info(`Scraped ${scrapeResult.ads.length} ads`);

    if (scrapeResult.errors.length > 0) {
      logger.warn(`Encountered ${scrapeResult.errors.length} errors during scraping`);
    }

    logger.info('Step 3: Saving to database...');
    await upsertAdCreatives(scrapeResult.ads);
    await upsertAdvertiser({
      ...advertiser,
      lastScrapedAt: new Date().toISOString(),
      lastTotalAdsFound: scrapeResult.totalFound,
      lastScrapeRegion: options.region,
    });

    logger.info('Step 4: Exporting data...');

    const exportData: ScrapeResult = {
      success: true,
      advertiser,
      ads: scrapeResult.ads,
      totalAdsFound: scrapeResult.totalFound,
      scrapedAt: new Date().toISOString(),
      errors: scrapeResult.errors.length > 0 ? scrapeResult.errors : undefined,
    };

    if (options.output === 'json' || options.output === 'both') {
      await exportToJson(exportData, options.outputDir, domain);
    }

    if (options.output === 'csv' || options.output === 'both') {
      await exportToCsv(exportData, options.outputDir, domain);
    }

    if (sessionId) {
      await completeScrapeSession(sessionId, scrapeResult.ads.length);
    }

    logger.info('');
    logger.info('='.repeat(50));
    logger.info('Scrape completed successfully!');
    logger.info(`Advertiser: ${advertiser.name}`);
    logger.info(`Ads found: ${scrapeResult.ads.length}`);
    logger.info(`Results saved to: ${options.outputDir}`);
    logger.info('='.repeat(50));
  } catch (error) {
    if (sessionId) {
      completeScrapeSession(
        sessionId,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    throw error;
  } finally {
    await browser.close();
  }
}
