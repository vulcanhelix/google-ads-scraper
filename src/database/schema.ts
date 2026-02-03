export const SCHEMA = `
-- Advertisers table
CREATE TABLE IF NOT EXISTS advertisers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  verification_status TEXT DEFAULT 'UNKNOWN',
  location TEXT,
  domain TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_advertisers_domain ON advertisers(domain);

-- Ad creatives table
CREATE TABLE IF NOT EXISTS ad_creatives (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  format TEXT NOT NULL,
  platforms TEXT NOT NULL,
  target_domain TEXT,
  first_shown TEXT,
  last_shown TEXT,
  total_days_shown INTEGER DEFAULT 0,
  details_url TEXT,
  preview_url TEXT,
  headline TEXT,
  description TEXT,
  image_url TEXT,
  video_url TEXT,
  region_stats TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id)
);

CREATE INDEX IF NOT EXISTS idx_ad_creatives_advertiser ON ad_creatives(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_format ON ad_creatives(format);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_first_shown ON ad_creatives(first_shown);

-- Scrape history table
CREATE TABLE IF NOT EXISTS scrape_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  ads_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'IN_PROGRESS',
  error_message TEXT,
  
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id)
);
`;

export const MIGRATIONS: { version: number; sql: string }[] = [];
