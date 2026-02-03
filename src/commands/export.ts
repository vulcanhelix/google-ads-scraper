import {
  initDatabase,
  getAdvertiserByDomain,
  getAdsByAdvertiser,
  closeDatabase,
} from '../database/db';
import { exportToJson, exportToCsv } from '../export';
import { ScrapeResult, AdCreative } from '../types';
import { logger } from '../utils/logger';

interface ExportOptions {
  output: 'json' | 'csv' | 'both';
  outputDir: string;
}

export async function exportData(
  domain: string,
  options: ExportOptions
): Promise<void> {
  logger.info(`Exporting data for domain: ${domain}`);

  initDatabase();

  try {
    const advertiser = getAdvertiserByDomain(domain);

    if (!advertiser) {
      throw new Error(
        `No data found for domain: ${domain}. Run 'scrape ${domain}' first.`
      );
    }

    const dbAds = getAdsByAdvertiser(advertiser.id);

    if (dbAds.length === 0) {
      throw new Error(`No ads found for advertiser: ${advertiser.name}`);
    }

    const ads: AdCreative[] = dbAds.map((dbAd) => ({
      id: dbAd.id,
      advertiserId: dbAd.advertiser_id,
      format: dbAd.format as 'text' | 'image' | 'video',
      platforms: JSON.parse(dbAd.platforms),
      targetDomain: dbAd.target_domain || undefined,
      firstShown: dbAd.first_shown,
      lastShown: dbAd.last_shown,
      totalDaysShown: dbAd.total_days_shown,
      detailsUrl: dbAd.details_url,
      previewUrl: dbAd.preview_url || undefined,
      headline: dbAd.headline || undefined,
      description: dbAd.description || undefined,
      imageUrl: dbAd.image_url || undefined,
      videoUrl: dbAd.video_url || undefined,
      regionStats: JSON.parse(dbAd.region_stats || '[]'),
    }));

    const exportResult: ScrapeResult = {
      success: true,
      advertiser: {
        id: advertiser.id,
        name: advertiser.name,
        verificationStatus: advertiser.verification_status,
        location: advertiser.location || undefined,
        domain: advertiser.domain || undefined,
      },
      ads,
      totalAdsFound: ads.length,
      scrapedAt: advertiser.updated_at,
    };

    if (options.output === 'json' || options.output === 'both') {
      await exportToJson(exportResult, options.outputDir, domain);
    }

    if (options.output === 'csv' || options.output === 'both') {
      await exportToCsv(exportResult, options.outputDir, domain);
    }

    logger.info(`Exported ${ads.length} ads for ${advertiser.name}`);
  } finally {
    closeDatabase();
  }
}
