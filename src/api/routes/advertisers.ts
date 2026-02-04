import { FastifyInstance } from 'fastify';
import {
  getAllAdvertisers,
  getAdvertiserById,
  getAdvertiserByDomain,
  getAdsByAdvertiser,
} from '../../database/repository';

export async function advertiserRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return getAllAdvertisers();
  });

  fastify.get('/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string };
    const advertiser = await getAdvertiserById(id);

    if (!advertiser) {
      return reply.code(404).send({ error: 'Advertiser not found' });
    }

    const advertiserData = advertiser as typeof advertiser & {
      lastTotalAdsFound?: number | null;
      lastScrapedAt?: Date | null;
      lastScrapeRegion?: string | null;
      lastOcrRunAt?: Date | null;
    };

    const ads = await getAdsByAdvertiser(id);
    const totalAds = ads.length;
    const previewCount = ads.filter((ad) => Boolean(ad.previewUrl)).length;
    const previewCoveragePercent = totalAds
      ? Math.round((previewCount / totalAds) * 100)
      : 0;

    const latestUpdatedAt = ads
      .map((ad) => ad.updatedAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const latestLastShown = ads
      .map((ad) => ad.lastShown)
      .map((value) => (value ? new Date(value) : null))
      .filter((value): value is Date =>
        value instanceof Date && !Number.isNaN(value.getTime())
      )
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const formatCounts = ads.reduce<Record<string, number>>((acc, ad) => {
      const key = ad.format || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const formatMix = Object.entries(formatCounts).map(([format, count]) => ({
      format,
      count: Number(count),
      percent: totalAds ? Math.round((count / totalAds) * 100) : 0,
    }));

    return {
      advertiser,
      totals: {
        ads: totalAds,
        previews: previewCount,
        previewCoveragePercent,
      },
      latestActivity: {
        updatedAt: latestUpdatedAt ?? null,
        lastShown: latestLastShown ?? null,
      },
      formatMix,
      lastScrape: {
        totalAdsFound: advertiserData.lastTotalAdsFound ?? null,
        scrapedAt: advertiserData.lastScrapedAt ?? null,
        region: advertiserData.lastScrapeRegion ?? null,
      },
      lastOcrRunAt: advertiserData.lastOcrRunAt ?? null,
    };
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const advertiser = await getAdvertiserById(id);
    
    if (!advertiser) {
      return reply.code(404).send({ error: 'Advertiser not found' });
    }
    return advertiser;
  });

  fastify.get('/domain/:domain', async (request, reply) => {
    const { domain } = request.params as { domain: string };
    const advertiser = await getAdvertiserByDomain(domain);
    
    if (!advertiser) {
      return reply.code(404).send({ error: 'Advertiser not found' });
    }
    return advertiser;
  });
}
