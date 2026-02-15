/**
 * Ad Intelligence Endpoint
 *
 * Aggregates ad copy, messaging themes, and CTAs for a given advertiser.
 * Designed to feed cold email pipelines that reference competitor ad strategy.
 *
 * GET /api/ads/advertiser/:advertiserId/intelligence
 */

import { FastifyInstance } from 'fastify';
import {
  getAdsByAdvertiser,
  getAdCount,
  getAdvertiserById,
} from '../../database/repository';
import prisma from '../../database/prisma';

export async function adsRoutes(fastify: FastifyInstance) {
  // --- Existing: get all ads for an advertiser ---
  fastify.get('/advertiser/:advertiserId', async (request) => {
    const { advertiserId } = request.params as { advertiserId: string };
    const ads = await getAdsByAdvertiser(advertiserId);
    const count = await getAdCount(advertiserId);

    return { count, ads };
  });

  // --- Existing: get ads that have headline/description ---
  fastify.get('/advertiser/:advertiserId/with-copy', async (request) => {
    const { advertiserId } = request.params as { advertiserId: string };
    const ads = await getAdsByAdvertiser(advertiserId);
    const withCopy = ads.filter((ad) => ad.headline || ad.description);

    return {
      count: withCopy.length,
      ads: withCopy,
    };
  });

  // --- NEW: Ad Intelligence endpoint for cold email context ---
  fastify.get('/advertiser/:advertiserId/intelligence', async (request, reply) => {
    const { advertiserId } = request.params as { advertiserId: string };
    const advertiser = await getAdvertiserById(advertiserId);

    if (!advertiser) {
      return reply.code(404).send({ error: 'Advertiser not found' });
    }

    const ads = await getAdsByAdvertiser(advertiserId);
    if (ads.length === 0) {
      return {
        advertiser: {
          id: advertiser.id,
          name: advertiser.name,
          domain: (advertiser as any).domain || null,
          verificationStatus: advertiser.verificationStatus,
        },
        summary: { totalAds: 0, textAds: 0, imageAds: 0, videoAds: 0 },
        adCopy: [],
        themes: [],
        topCTAs: [],
        messagingAngles: [],
      };
    }

    // --- Ad format breakdown ---
    const textAds = ads.filter((a) => a.format === 'text');
    const imageAds = ads.filter((a) => a.format === 'image');
    const videoAds = ads.filter((a) => a.format === 'video');
    const withCopy = ads.filter((a) => a.headline || a.description);

    // Date range
    const dates = ads
      .map((a) => a.firstShown)
      .filter((d): d is string => !!d)
      .sort();
    const lastDates = ads
      .map((a) => a.lastShown)
      .filter((d): d is string => !!d)
      .sort();

    const longestRunning = ads.reduce((max, a) => Math.max(max, a.totalDaysShown || 0), 0);

    // --- Extract ad copy sorted by longevity (longest-running = most successful) ---
    const adCopy = withCopy
      .sort((a, b) => (b.totalDaysShown || 0) - (a.totalDaysShown || 0))
      .map((ad) => ({
        creativeId: ad.id,
        headline: ad.headline || null,
        description: ad.description || null,
        format: ad.format,
        daysActive: ad.totalDaysShown || 0,
        firstShown: ad.firstShown || null,
        lastShown: ad.lastShown || null,
        detailsUrl: ad.detailsUrl,
      }));

    // --- Extract themes from headlines and descriptions ---
    const allText = withCopy
      .map((ad) => `${ad.headline || ''} ${ad.description || ''}`)
      .join(' ')
      .toLowerCase();

    const themes = extractThemes(allText);
    const topCTAs = extractCTAs(withCopy);
    const messagingAngles = extractMessagingAngles(withCopy);

    return {
      advertiser: {
        id: advertiser.id,
        name: advertiser.name,
        domain: (advertiser as any).domain || null,
        verificationStatus: advertiser.verificationStatus,
        location: (advertiser as any).location || null,
      },
      summary: {
        totalAds: ads.length,
        textAds: textAds.length,
        imageAds: imageAds.length,
        videoAds: videoAds.length,
        adsWithCopy: withCopy.length,
        longestRunningDays: longestRunning,
        dateRange: {
          earliest: dates[0] || null,
          latest: lastDates[lastDates.length - 1] || null,
        },
      },
      adCopy,
      themes,
      topCTAs,
      messagingAngles,
    };
  });

  // --- Existing: single ad by ID ---
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ad = await prisma.adCreative.findUnique({
      where: { id },
      include: { advertiser: true },
    });

    if (!ad) {
      return reply.code(404).send({ error: 'Ad not found' });
    }
    return ad;
  });
}

// ---- Helper functions for theme/CTA extraction ----

/**
 * Extract recurring themes from aggregated ad text.
 * Uses keyword frequency analysis over common advertising categories.
 */
function extractThemes(text: string): string[] {
  const themePatterns: Record<string, RegExp[]> = {
    'free shipping': [/free\s+shipping/gi, /ships?\s+free/gi],
    'limited time': [/limited\s+time/gi, /hurry/gi, /act\s+now/gi, /don'?t\s+miss/gi],
    'discount/sale': [/\d+%\s+off/gi, /sale/gi, /discount/gi, /save\s+\$/gi, /deals?/gi],
    'premium quality': [/premium/gi, /quality/gi, /professional/gi, /best\s+in\s+class/gi],
    'money-back guarantee': [/money.?back/gi, /guarantee/gi, /risk.?free/gi, /refund/gi],
    'social proof': [/trusted/gi, /\d+\+?\s*(customers?|clients?|reviews?|ratings?)/gi, /rated/gi],
    'free trial': [/free\s+trial/gi, /try\s+(it\s+)?free/gi, /no\s+credit\s+card/gi],
    'bulk/wholesale': [/bulk/gi, /wholesale/gi, /volume/gi, /quantity/gi],
    'fast delivery': [/fast\s+(delivery|shipping)/gi, /same.?day/gi, /next.?day/gi, /express/gi],
    'new product': [/new\s+(arrival|product|launch)/gi, /just\s+arrived/gi, /introducing/gi],
    'comparison': [/better\s+than/gi, /vs\.?/gi, /compared?\s+to/gi, /switch/gi, /alternative/gi],
    'exclusivity': [/exclusive/gi, /only\s+(at|on|here)/gi, /members?\s+only/gi],
    'ease of use': [/easy/gi, /simple/gi, /hassle.?free/gi, /no\s+stress/gi, /effortless/gi],
    'custom/personalized': [/custom/gi, /personali[sz]/gi, /tailored/gi, /your\s+own/gi],
    'local/nearby': [/local/gi, /near\s+(you|me)/gi, /in\s+your\s+area/gi, /nearby/gi],
  };

  const found: string[] = [];
  for (const [theme, patterns] of Object.entries(themePatterns)) {
    const matches = patterns.some((p) => p.test(text));
    if (matches) found.push(theme);
  }

  return found;
}

/**
 * Extract call-to-action phrases from ads.
 */
function extractCTAs(ads: Array<{ headline?: string | null; description?: string | null }>): string[] {
  const ctaPatterns = [
    /shop\s+now/gi,
    /buy\s+now/gi,
    /order\s+(now|today)/gi,
    /get\s+started/gi,
    /learn\s+more/gi,
    /sign\s+up/gi,
    /try\s+(it\s+)?(now|free|today)/gi,
    /start\s+(your|a)\s+free/gi,
    /call\s+(now|us|today)/gi,
    /book\s+(now|today|a)/gi,
    /request\s+a?\s*(quote|demo|consultation)/gi,
    /download\s+(now|free|today)/gi,
    /subscribe/gi,
    /claim\s+your/gi,
    /explore/gi,
    /discover/gi,
    /view\s+(all|our|more)/gi,
    /get\s+(a\s+)?quote/gi,
    /contact\s+us/gi,
    /schedule/gi,
    /apply\s+now/gi,
    /join\s+(now|us|today)/gi,
    /see\s+(how|why|our)/gi,
    /find\s+out/gi,
    /compare/gi,
  ];

  const allText = ads
    .map((ad) => `${ad.headline || ''} ${ad.description || ''}`)
    .join(' ');

  const found = new Set<string>();
  for (const pattern of ctaPatterns) {
    const matches = allText.match(pattern);
    if (matches) {
      matches.forEach((m) => found.add(m.toLowerCase().trim()));
    }
  }

  return Array.from(found);
}

/**
 * Extract high-level messaging angles from the longest-running ads.
 * Longest-running ads = most successful (advertiser keeps paying for them).
 */
function extractMessagingAngles(
  ads: Array<{
    headline?: string | null;
    description?: string | null;
    totalDaysShown?: number;
    format?: string;
  }>
): Array<{ angle: string; evidence: string; daysActive: number }> {
  // Focus on the top 5 longest-running ads with text
  const topAds = ads
    .filter((a) => a.headline || a.description)
    .sort((a, b) => (b.totalDaysShown || 0) - (a.totalDaysShown || 0))
    .slice(0, 5);

  return topAds.map((ad) => {
    const headline = ad.headline || '';
    const desc = ad.description || '';
    const combined = `${headline} ${desc}`.trim();

    // Classify the angle
    let angle = 'general promotion';
    if (/free|complimentary|no\s+cost/i.test(combined)) angle = 'free offer / lead magnet';
    else if (/save|discount|\d+%|off|deal|sale/i.test(combined)) angle = 'price / discount driven';
    else if (/best|top|#1|leading|premium|quality/i.test(combined)) angle = 'quality / authority positioning';
    else if (/fast|quick|instant|today|now|same.?day/i.test(combined)) angle = 'urgency / speed';
    else if (/easy|simple|effortless|hassle/i.test(combined)) angle = 'ease / convenience';
    else if (/trusted|review|customer|rated|star/i.test(combined)) angle = 'social proof / trust';
    else if (/new|introducing|launch|just/i.test(combined)) angle = 'new product / launch';
    else if (/custom|your|personali/i.test(combined)) angle = 'personalization';
    else if (/compare|vs|switch|alternative|better/i.test(combined)) angle = 'competitive comparison';
    else if (/local|near|area/i.test(combined)) angle = 'local targeting';

    return {
      angle,
      evidence: combined.length > 120 ? combined.slice(0, 120) + '…' : combined,
      daysActive: ad.totalDaysShown || 0,
    };
  });
}
