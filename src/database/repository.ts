import prisma from './prisma';
import { Advertiser, AdCreative, AdRegionStats, DbAdCreative } from '../types';
import { Prisma } from '@prisma/client';

export async function upsertAdvertiser(advertiser: Advertiser) {
  return prisma.advertiser.upsert({
    where: { id: advertiser.id },
    update: {
      name: advertiser.name,
      verificationStatus: advertiser.verificationStatus,
      location: advertiser.location,
      domain: advertiser.domain,
      lastScrapedAt: advertiser.lastScrapedAt ? new Date(advertiser.lastScrapedAt) : undefined,
      lastTotalAdsFound: advertiser.lastTotalAdsFound,
      lastScrapeRegion: advertiser.lastScrapeRegion,
    },
    create: {
      id: advertiser.id,
      name: advertiser.name,
      verificationStatus: advertiser.verificationStatus,
      location: advertiser.location,
      domain: advertiser.domain,
      lastScrapedAt: advertiser.lastScrapedAt ? new Date(advertiser.lastScrapedAt) : undefined,
      lastTotalAdsFound: advertiser.lastTotalAdsFound,
      lastScrapeRegion: advertiser.lastScrapeRegion,
    },
  });
}

export async function getAdvertiserByDomain(domain: string) {
  return prisma.advertiser.findUnique({
    where: { domain },
  });
}

export async function getAdvertiserById(id: string) {
  return prisma.advertiser.findUnique({
    where: { id },
  });
}

export async function getAllAdvertisers() {
  try {
    return prisma.advertiser.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching advertisers:', error);
    throw new Error('Failed to fetch advertisers from database');
  }
}

export async function upsertAdCreatives(ads: AdCreative[]) {
  // Prisma doesn't support bulk upsert efficiently for complex where clauses in all DBs,
  // but for Postgres we can use transaction with individual upserts or createMany with skipDuplicates if we didn't need updates.
  // Since we want to update checking dates, we'll use a transaction of upserts.

  const operations = ads.map((ad) =>
    prisma.adCreative.upsert({
      where: { id: ad.id },
      update: {
        format: ad.format,
        platforms: ad.platforms,
        targetDomain: ad.targetDomain,
        lastShown: ad.lastShown, // Update last seen
        totalDaysShown: ad.totalDaysShown,
        detailsUrl: ad.detailsUrl,
        previewUrl: ad.previewUrl,
        headline: ad.headline,
        description: ad.description,
        headlineConfidence: ad.headlineConfidence,
        descriptionConfidence: ad.descriptionConfidence,
        imageUrl: ad.imageUrl,
        videoUrl: ad.videoUrl,
        regionStats: ad.regionStats as any,
      },
      create: {
        id: ad.id,
        advertiserId: ad.advertiserId,
        format: ad.format,
        platforms: ad.platforms,
        targetDomain: ad.targetDomain,
        firstShown: ad.firstShown,
        lastShown: ad.lastShown,
        totalDaysShown: ad.totalDaysShown,
        detailsUrl: ad.detailsUrl,
        previewUrl: ad.previewUrl,
        headline: ad.headline,
        description: ad.description,
        headlineConfidence: ad.headlineConfidence,
        descriptionConfidence: ad.descriptionConfidence,
        imageUrl: ad.imageUrl,
        videoUrl: ad.videoUrl,
        regionStats: ad.regionStats as any,
      },
    })
  );

  return prisma.$transaction(operations);
}

export async function getAdsByAdvertiser(advertiserId: string) {
  try {
    return prisma.adCreative.findMany({
      where: { advertiserId },
      orderBy: { firstShown: 'desc' },
    });
  } catch (error) {
    console.error(`Error fetching ads for advertiser ${advertiserId}:`, error);
    throw new Error('Failed to fetch ads from database');
  }
}

export async function updateAdCreativeText(
  id: string,
  data: {
    headline?: string | null;
    description?: string | null;
    headlineConfidence?: number | null;
    descriptionConfidence?: number | null;
  }
) {
  return prisma.adCreative.update({
    where: { id },
    data,
  });
}

export async function getAdCount(advertiserId: string) {
  return prisma.adCreative.count({
    where: { advertiserId },
  });
}

export async function startScrapeSession(advertiserId: string) {
  const session = await prisma.scrapeSession.create({
    data: {
      advertiserId,
      status: 'IN_PROGRESS',
    },
  });
  return session.id;
}

export async function completeScrapeSession(
  sessionId: number,
  adsFound: number,
  errorMessage?: string
) {
  return prisma.scrapeSession.update({
    where: { id: sessionId },
    data: {
      completedAt: new Date(),
      adsFound,
      status: errorMessage ? 'FAILED' : 'COMPLETED',
      errorMessage,
    },
  });
}

export async function closeDatabase() {
  await prisma.$disconnect();
}
