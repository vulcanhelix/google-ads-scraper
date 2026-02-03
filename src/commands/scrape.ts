import { createBrowser, createContext, createPage } from '../scraper/browser';
import { lookupAdvertiserByDomain } from '../scraper/advertiser';
import { scrapeAdvertiserAds } from '../scraper/ads';
import {
  upsertAdvertiser,
  upsertAdCreatives,
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
  logger.info(`Starting scrape for domain: ${domain}`);
  logger.info(`Options: ${JSON.stringify(options)}`);



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

    upsertAdvertiser(advertiser);

    sessionId = await startScrapeSession(advertiser.id);

    logger.info('Step 2: Scraping ads...');

    const filters: ScrapeFilters = {
      region: options.region,
      format: options.format as AdFormat | undefined,
      platform: options.platform as AdPlatform | undefined,
      maxResults: options.max,
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
    upsertAdCreatives(scrapeResult.ads);

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
