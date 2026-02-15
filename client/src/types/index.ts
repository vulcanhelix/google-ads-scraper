export interface Advertiser {
  id: string;
  name: string;
  verificationStatus: string;
  location?: string;
  domain?: string;
  lastScrapedAt?: string;
  lastTotalAdsFound?: number;
  lastScrapeRegion?: string;
  createdAt?: string;
  updatedAt?: string;
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
  advertiser?: Advertiser;
  format: AdFormat;
  platforms: AdPlatform[];
  targetDomain?: string;
  firstShown?: string;
  lastShown?: string;
  totalDaysShown: number;
  detailsUrl: string;
  previewUrl?: string;
  headline?: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  regionStats?: AdRegionStats[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ScrapeResult {
  success: boolean;
  advertiser: Advertiser;
  ads: AdCreative[];
  totalAdsFound: number;
  scrapedAt: string;
  errors?: string[];
}

export interface AdvertiserSummary {
  advertiser: Advertiser;
  totals: {
    ads: number;
    previews: number;
    previewCoveragePercent: number;
  };
  latestActivity: {
    updatedAt: Date | null;
    lastShown: Date | null;
  };
  formatMix: Array<{
    format: string;
    count: number;
    percent: number;
  }>;
  lastScrape: {
    totalAdsFound: number | null;
    scrapedAt: Date | null;
    region: string | null;
  };
}

export interface AdsResponse {
  count: number;
  ads: AdCreative[];
}

// --- Ad Intelligence for cold email context ---

export interface AdIntelligence {
  advertiser: {
    id: string;
    name: string;
    domain: string | null;
    verificationStatus: string;
    location?: string | null;
  };
  summary: {
    totalAds: number;
    textAds: number;
    imageAds: number;
    videoAds: number;
    adsWithCopy: number;
    longestRunningDays: number;
    dateRange: {
      earliest: string | null;
      latest: string | null;
    };
  };
  adCopy: Array<{
    creativeId: string;
    headline: string | null;
    description: string | null;
    format: string;
    daysActive: number;
    firstShown: string | null;
    lastShown: string | null;
    detailsUrl: string;
  }>;
  themes: string[];
  topCTAs: string[];
  messagingAngles: Array<{
    angle: string;
    evidence: string;
    daysActive: number;
  }>;
}

// --- Batch / scrape types ---

export interface BatchItem {
  domain: string;
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  adsFound?: number;
  advertiser?: Advertiser;
  ads?: AdCreative[];
  error?: string;
}

export interface BatchProgress {
  currentIndex: number;
  total: number;
  currentDomain: string;
  status: 'scraping' | 'completed' | 'failed';
}

export interface BatchScrapeResult {
  results: BatchItem[];
  totalAds: number;
  completedDomains: number;
  failedDomains: number;
}

export interface ScrapeFormData {
  apiKey: string;
  mode: 'single' | 'batch';
  domains: string | string[];
  region?: string;
  maxResults: number;
}

export interface ScrapeOptions {
  region?: string;
  maxResults: number;
}

export interface ScrapeResponse {
  statusCode: number;
  status: string;
  domain: string;
  message?: string;
  advertiser?: Advertiser | null;
  summary?: {
    totalAds: number;
    textAds: number;
    imageAds: number;
    videoAds: number;
    adsWithHeadline: number;
    longestRunningDays: number;
  } | null;
  ads?: AdCreative[];
}

export interface APIError {
  statusCode: number;
  error: string;
  message: string;
}
