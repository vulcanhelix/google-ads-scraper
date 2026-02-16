export interface Advertiser {
  id: string;
  name: string;
  verificationStatus: string;
  location?: string;
  domain?: string;
  lastScrapedAt?: string;
  lastTotalAdsFound?: number;
  lastScrapeRegion?: string;
  lastOcrRunAt?: string;
}

export type AdFormat = 'text' | 'image' | 'video';

export type AdPlatform =
  | 'google_search'
  | 'youtube'
  | 'google_maps'
  | 'google_play'
  | 'google_shopping'
  | 'display_network'
  | 'unknown';

export interface AdRegionStats {
  regionCode: string;
  firstShown: string;
  lastShown: string;
  timesShownLowerBound?: number;
  timesShownUpperBound?: number;
}

export interface AdCreative {
  id: string;
  advertiserId: string;
  advertiserName?: string;
  format: AdFormat;
  platforms: AdPlatform[];
  targetDomain?: string;
  firstShown: string;
  lastShown: string;
  totalDaysShown: number;
  detailsUrl: string;
  previewUrl?: string;
  regionStats: AdRegionStats[];
  headline?: string;
  description?: string;
  headlineConfidence?: number;
  descriptionConfidence?: number;
  imageUrl?: string;
  videoUrl?: string;
}

export interface ScrapeResult {
  success: boolean;
  advertiser: Advertiser;
  ads: AdCreative[];
  totalAdsFound: number;
  scrapedAt: string;
  errors?: string[];
}

export interface ScrapeFilters {
  region?: string;
  platform?: AdPlatform;
  format?: AdFormat;
  startDate?: string;
  endDate?: string;
  maxResults?: number;
  extractHeadlines?: boolean;
}

export interface ScraperConfig {
  headless: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  delays: {
    betweenPages: number;
    betweenScrolls: number;
    afterSearch: number;
  };
  retries: {
    maxAttempts: number;
    backoffMs: number;
  };
  output: {
    format: 'json' | 'csv' | 'both';
    directory: string;
  };
}

export interface DbAdvertiser {
  id: string;
  name: string;
  verification_status: string;
  location: string | null;
  domain: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAdCreative {
  id: string;
  advertiser_id: string;
  format: string;
  platforms: string;
  target_domain: string | null;
  first_shown: string;
  last_shown: string;
  total_days_shown: number;
  details_url: string;
  preview_url: string | null;
  headline: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  region_stats: string;
  created_at: string;
  updated_at: string;
}
