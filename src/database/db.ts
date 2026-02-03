import fs from 'fs';
import path from 'path';
import { Advertiser, AdCreative, DbAdvertiser, DbAdCreative } from '../types';
import { logger } from '../utils/logger';

interface Database {
  advertisers: Record<string, DbAdvertiser>;
  ads: Record<string, DbAdCreative>;
  scrapeHistory: Array<{
    id: number;
    advertiser_id: string;
    started_at: string;
    completed_at: string | null;
    ads_found: number;
    status: string;
    error_message: string | null;
  }>;
}

let dbPath: string | null = null;
let db: Database | null = null;

function getDefaultDbPath(): string {
  return path.join(process.cwd(), 'data', 'ads.json');
}

function loadDb(): Database {
  if (!dbPath) {
    dbPath = getDefaultDbPath();
  }

  if (db) return db;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const content = fs.readFileSync(dbPath, 'utf-8');
    db = JSON.parse(content);
  } else {
    db = {
      advertisers: {},
      ads: {},
      scrapeHistory: [],
    };
  }

  return db!;
}

function saveDb(): void {
  if (!db || !dbPath) return;
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function initDatabase(customPath?: string): void {
  dbPath = customPath || getDefaultDbPath();
  db = null;
  loadDb();
  logger.info(`Database initialized at: ${dbPath}`);
}

export function closeDatabase(): void {
  if (db) {
    saveDb();
    db = null;
  }
}

export function upsertAdvertiser(advertiser: Advertiser): void {
  const database = loadDb();
  const now = new Date().toISOString();

  database.advertisers[advertiser.id] = {
    id: advertiser.id,
    name: advertiser.name,
    verification_status: advertiser.verificationStatus,
    location: advertiser.location || null,
    domain: advertiser.domain || null,
    created_at: database.advertisers[advertiser.id]?.created_at || now,
    updated_at: now,
  };

  saveDb();
}

export function getAdvertiserByDomain(domain: string): DbAdvertiser | null {
  const database = loadDb();
  const advertisers = Object.values(database.advertisers);
  return advertisers.find((a) => a.domain === domain) || null;
}

export function getAdvertiserById(id: string): DbAdvertiser | null {
  const database = loadDb();
  return database.advertisers[id] || null;
}

export function getAllAdvertisers(): DbAdvertiser[] {
  const database = loadDb();
  return Object.values(database.advertisers).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function upsertAdCreative(ad: AdCreative): void {
  const database = loadDb();
  const now = new Date().toISOString();

  database.ads[ad.id] = {
    id: ad.id,
    advertiser_id: ad.advertiserId,
    format: ad.format,
    platforms: JSON.stringify(ad.platforms),
    target_domain: ad.targetDomain || null,
    first_shown: ad.firstShown,
    last_shown: ad.lastShown,
    total_days_shown: ad.totalDaysShown,
    details_url: ad.detailsUrl,
    preview_url: ad.previewUrl || null,
    headline: ad.headline || null,
    description: ad.description || null,
    image_url: ad.imageUrl || null,
    video_url: ad.videoUrl || null,
    region_stats: JSON.stringify(ad.regionStats),
    created_at: database.ads[ad.id]?.created_at || now,
    updated_at: now,
  };

  saveDb();
}

export function upsertAdCreatives(ads: AdCreative[]): void {
  const database = loadDb();
  const now = new Date().toISOString();

  for (const ad of ads) {
    database.ads[ad.id] = {
      id: ad.id,
      advertiser_id: ad.advertiserId,
      format: ad.format,
      platforms: JSON.stringify(ad.platforms),
      target_domain: ad.targetDomain || null,
      first_shown: ad.firstShown,
      last_shown: ad.lastShown,
      total_days_shown: ad.totalDaysShown,
      details_url: ad.detailsUrl,
      preview_url: ad.previewUrl || null,
      headline: ad.headline || null,
      description: ad.description || null,
      image_url: ad.imageUrl || null,
      video_url: ad.videoUrl || null,
      region_stats: JSON.stringify(ad.regionStats),
      created_at: database.ads[ad.id]?.created_at || now,
      updated_at: now,
    };
  }

  saveDb();
}

export function getAdsByAdvertiser(advertiserId: string): DbAdCreative[] {
  const database = loadDb();
  return Object.values(database.ads)
    .filter((ad) => ad.advertiser_id === advertiserId)
    .sort(
      (a, b) =>
        new Date(b.first_shown || 0).getTime() -
        new Date(a.first_shown || 0).getTime()
    );
}

export function getAdCount(advertiserId: string): number {
  const database = loadDb();
  return Object.values(database.ads).filter(
    (ad) => ad.advertiser_id === advertiserId
  ).length;
}

export function startScrapeSession(advertiserId: string): number {
  const database = loadDb();
  const id = database.scrapeHistory.length + 1;

  database.scrapeHistory.push({
    id,
    advertiser_id: advertiserId,
    started_at: new Date().toISOString(),
    completed_at: null,
    ads_found: 0,
    status: 'IN_PROGRESS',
    error_message: null,
  });

  saveDb();
  return id;
}

export function completeScrapeSession(
  sessionId: number,
  adsFound: number,
  error?: string
): void {
  const database = loadDb();
  const session = database.scrapeHistory.find((s) => s.id === sessionId);

  if (session) {
    session.completed_at = new Date().toISOString();
    session.ads_found = adsFound;
    session.status = error ? 'FAILED' : 'COMPLETED';
    session.error_message = error || null;
    saveDb();
  }
}
