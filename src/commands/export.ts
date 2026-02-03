import {
  getAdvertiserByDomain,
  getAdsByAdvertiser,
} from '../database/repository';
import { exportToJson, exportToCsv } from '../export';
import { ScrapeResult, AdCreative } from '../types';
import { logger } from '../utils/logger';

interface ExportOptions {
  output: 'json' | 'csv' | 'both';
  outputDir: string;
}

export async function exportData(domain: string, options: ExportOptions): Promise<void> {
  logger.info(`Exporting data for domain: ${domain}`);

  try {
    const advertiser = await getAdvertiserByDomain(domain);

    if (!advertiser) {
      throw new Error(`Advertiser not found for domain: ${domain}`);
    }

    const dbAds = await getAdsByAdvertiser(advertiser.id);

    if (dbAds.length === 0) {
      throw new Error(`No ads found for advertiser: ${advertiser.name}`);
    }

    // Map Prisma DB objects to AdCreative type
    const ads: AdCreative[] = dbAds.map((dbAd: any) => ({
      id: dbAd.id,
      advertiserId: dbAd.advertiserId,
      format: dbAd.format as 'text' | 'image' | 'video',
      platforms: dbAd.platforms as any[],
      targetDomain: dbAd.targetDomain || undefined,
      firstShown: dbAd.firstShown || '',
      lastShown: dbAd.lastShown || '',
      totalDaysShown: dbAd.totalDaysShown,
      detailsUrl: dbAd.detailsUrl,
      previewUrl: dbAd.previewUrl || undefined,
      headline: dbAd.headline || undefined,
      description: dbAd.description || undefined,
      imageUrl: dbAd.imageUrl || undefined,
      videoUrl: dbAd.videoUrl || undefined,
      regionStats: (dbAd.regionStats as any) || [],
    }));

    const result: ScrapeResult = {
      success: true,
      advertiser: {
        id: advertiser.id,
        name: advertiser.name,
        verificationStatus: advertiser.verificationStatus,
        location: advertiser.location || undefined,
        domain: advertiser.domain || undefined,
      },
      ads,
      totalAdsFound: ads.length,
      scrapedAt: advertiser.updatedAt.toISOString(),
      errors: [],
    };

    if (options.output === 'json' || options.output === 'both') {
      await exportToJson(result, options.outputDir, domain);
    }

    if (options.output === 'csv' || options.output === 'both') {
      await exportToCsv(result, options.outputDir, domain);
    }

    logger.info(`Exported ${ads.length} ads for ${advertiser.name}`);
  } catch (error) {
    logger.error('Export failed:', error);
    throw error;
  }
}
