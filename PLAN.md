# Google Ads Transparency Center Scraper - Implementation Plan

## Overview

Build a zero-cost scraper that takes a domain (e.g., `tesla.com`) and returns all Google Ads that company is running. Uses Google's official Ads Transparency Center as the data source.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Data Source Deep Dive](#data-source-deep-dive)
3. [Project Structure](#project-structure)
4. [Phase 1: Advertiser Lookup](#phase-1-advertiser-lookup)
5. [Phase 2: Ad Scraping](#phase-2-ad-scraping)
6. [Phase 3: Data Parsing & Storage](#phase-3-data-parsing--storage)
7. [Phase 4: CLI Interface](#phase-4-cli-interface)
8. [Phase 5: Anti-Bot Handling](#phase-5-anti-bot-handling)
9. [Phase 6: Export & Output](#phase-6-export--output)
10. [Optional: BigQuery Alternative](#optional-bigquery-alternative)
11. [Deployment Options](#deployment-options)
12. [File-by-File Implementation Guide](#file-by-file-implementation-guide)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│                         domain: "tesla.com"                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STEP 1: ADVERTISER LOOKUP                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  URL: https://adstransparency.google.com                            │    │
│  │  Action: Search for domain → Get advertiser_id (AR...)              │    │
│  │  Example: tesla.com → AR17828074650563772417                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STEP 2: SCRAPE ADS PAGE                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  URL: https://adstransparency.google.com/advertiser/{advertiser_id} │    │
│  │  Action: Load all ads (handle infinite scroll/pagination)          │    │
│  │  Extract: Ad creatives, formats, dates, platforms, regions         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STEP 3: PARSE & STORE                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Parse HTML/JSON responses                                          │    │
│  │  Store in SQLite database                                           │    │
│  │  Export to JSON/CSV                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUT                                          │
│  {                                                                           │
│    "advertiser": { "id": "AR...", "name": "Tesla Inc." },                   │
│    "total_ads": 156,                                                         │
│    "ads": [                                                                  │
│      { "id": "CR...", "format": "video", "platform": "youtube", ... }       │
│    ]                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Source Deep Dive

### Google Ads Transparency Center

**Website**: https://adstransparency.google.com

**What it provides**:
- All active ads an advertiser is running
- Ad format (text, image, video)
- Platform (Google Search, YouTube, Google Maps, Google Play, Google Shopping)
- Date range (first shown, last shown)
- Region targeting
- Advertiser verification status

### URL Patterns

| Action | URL Pattern |
|--------|-------------|
| Homepage | `https://adstransparency.google.com` |
| Search | `https://adstransparency.google.com/?text={query}` |
| Advertiser page | `https://adstransparency.google.com/advertiser/{advertiser_id}` |
| Advertiser + Region | `https://adstransparency.google.com/advertiser/{advertiser_id}?region=US` |
| Ad detail | `https://adstransparency.google.com/advertiser/{advertiser_id}/creative/{creative_id}` |

### Advertiser ID Format

- Starts with `AR` followed by 17 digits
- Example: `AR17828074650563772417` (Tesla Inc.)

### Creative ID Format

- Starts with `CR` followed by 17 digits
- Example: `CR03335465984256376833`

---

## Project Structure

```
Google_Ads_Scraper/
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── .env.example              # Environment template
├── .gitignore
├── README.md
│
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config.ts             # Configuration constants
│   │
│   ├── scraper/
│   │   ├── browser.ts        # Playwright browser setup
│   │   ├── advertiser.ts     # Advertiser lookup logic
│   │   ├── ads.ts            # Ads scraping logic
│   │   └── parser.ts         # HTML/JSON parsing
│   │
│   ├── database/
│   │   ├── schema.ts         # SQLite schema definition
│   │   ├── db.ts             # Database operations
│   │   └── migrations/       # Schema migrations
│   │
│   ├── export/
│   │   ├── json.ts           # JSON export
│   │   └── csv.ts            # CSV export
│   │
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   │
│   └── utils/
│       ├── delay.ts          # Rate limiting utilities
│       ├── retry.ts          # Retry logic
│       └── logger.ts         # Logging utility
│
├── data/
│   ├── ads.db                # SQLite database (gitignored)
│   └── exports/              # Exported files
│
└── tests/
    ├── advertiser.test.ts
    └── parser.test.ts
```

---

## Phase 1: Advertiser Lookup

### Goal
Given a domain like `tesla.com`, find the advertiser ID (e.g., `AR17828074650563772417`).

### Technical Approach

**Method 1: Direct URL Search (Preferred)**
```
https://adstransparency.google.com/?text=tesla.com
```

The search results will contain advertiser cards. Each card links to:
```
/advertiser/AR17828074650563772417
```

**Method 2: Domain-Based URL**
Some advertisers have verified domains, allowing direct navigation:
```
https://adstransparency.google.com/advertiser?domain=tesla.com
```

### Implementation Steps

#### Step 1.1: Create `src/scraper/browser.ts`

```typescript
// PURPOSE: Initialize Playwright browser with stealth settings

import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowserConfig {
  headless: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  userAgent?: string;
}

export async function createBrowser(config: BrowserConfig): Promise<Browser> {
  // Launch Chromium with specific args to avoid detection
  const browser = await chromium.launch({
    headless: config.headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  return browser;
}

export async function createContext(
  browser: Browser, 
  config: BrowserConfig
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    proxy: config.proxy,
    // Disable webdriver flag
    javaScriptEnabled: true,
  });
  
  // Add stealth scripts before page loads
  await context.addInitScript(() => {
    // Override webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
    
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
  });
  
  return context;
}

export async function createPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  
  // Set extra headers to appear more legitimate
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });
  
  return page;
}
```

#### Step 1.2: Create `src/scraper/advertiser.ts`

```typescript
// PURPOSE: Look up advertiser ID from domain

import { Page } from 'playwright';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

export interface AdvertiserInfo {
  id: string;                    // e.g., "AR17828074650563772417"
  name: string;                  // e.g., "Tesla Inc."
  verificationStatus: string;    // e.g., "VERIFIED"
  location?: string;             // e.g., "US"
}

export interface AdvertiserLookupResult {
  success: boolean;
  advertiser?: AdvertiserInfo;
  error?: string;
  alternatives?: AdvertiserInfo[];  // If multiple matches found
}

const BASE_URL = 'https://adstransparency.google.com';

export async function lookupAdvertiserByDomain(
  page: Page,
  domain: string
): Promise<AdvertiserLookupResult> {
  try {
    logger.info(`Looking up advertiser for domain: ${domain}`);
    
    // Step 1: Navigate to the transparency center
    await page.goto(BASE_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Step 2: Wait for the search input to be available
    // The search input is typically an input field or a clickable search area
    const searchSelector = 'input[type="text"], input[aria-label*="search" i], [role="searchbox"]';
    await page.waitForSelector(searchSelector, { timeout: 10000 });
    
    // Step 3: Type the domain into the search
    await page.fill(searchSelector, domain);
    await delay(500); // Small delay to let autocomplete work
    
    // Step 4: Press Enter or click search button
    await page.keyboard.press('Enter');
    
    // Step 5: Wait for results to load
    await page.waitForLoadState('networkidle');
    await delay(2000); // Additional wait for dynamic content
    
    // Step 6: Look for advertiser links in the results
    // Advertiser links follow the pattern: /advertiser/AR{17digits}
    const advertiserLinks = await page.$$eval(
      'a[href*="/advertiser/AR"]',
      (links) => links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim()
      }))
    );
    
    if (advertiserLinks.length === 0) {
      // Try alternative: Check if we're already on an advertiser page
      const currentUrl = page.url();
      const match = currentUrl.match(/\/advertiser\/(AR\d+)/);
      
      if (match) {
        const advertiserId = match[1];
        const advertiserName = await extractAdvertiserName(page);
        
        return {
          success: true,
          advertiser: {
            id: advertiserId,
            name: advertiserName,
            verificationStatus: 'UNKNOWN'
          }
        };
      }
      
      return {
        success: false,
        error: `No advertisers found for domain: ${domain}`
      };
    }
    
    // Step 7: Extract advertiser ID from the first (most relevant) link
    const firstLink = advertiserLinks[0];
    const idMatch = firstLink.href?.match(/\/advertiser\/(AR\d+)/);
    
    if (!idMatch) {
      return {
        success: false,
        error: 'Could not extract advertiser ID from results'
      };
    }
    
    const advertiserId = idMatch[1];
    
    // Step 8: Navigate to advertiser page to get full details
    await page.goto(`${BASE_URL}/advertiser/${advertiserId}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    const advertiserName = await extractAdvertiserName(page);
    const verificationStatus = await extractVerificationStatus(page);
    
    // Step 9: If multiple matches, include alternatives
    const alternatives = advertiserLinks.slice(1).map(link => {
      const id = link.href?.match(/\/advertiser\/(AR\d+)/)?.[1] || '';
      return {
        id,
        name: link.text || '',
        verificationStatus: 'UNKNOWN'
      };
    });
    
    return {
      success: true,
      advertiser: {
        id: advertiserId,
        name: advertiserName,
        verificationStatus
      },
      alternatives: alternatives.length > 0 ? alternatives : undefined
    };
    
  } catch (error) {
    logger.error('Advertiser lookup failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function extractAdvertiserName(page: Page): Promise<string> {
  // The advertiser name is typically in an h1 or prominent heading
  const selectors = [
    'h1',
    '[data-advertiser-name]',
    '.advertiser-name',
    '[role="heading"]'
  ];
  
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      }
    } catch {
      continue;
    }
  }
  
  return 'Unknown Advertiser';
}

async function extractVerificationStatus(page: Page): Promise<string> {
  // Look for verification badge or status text
  const verifiedIndicators = [
    '[data-verified="true"]',
    '.verified-badge',
    ':text("verified")'
  ];
  
  for (const selector of verifiedIndicators) {
    try {
      const element = await page.$(selector);
      if (element) {
        return 'VERIFIED';
      }
    } catch {
      continue;
    }
  }
  
  return 'NOT_VERIFIED';
}
```

#### Step 1.3: Create `src/types/index.ts`

```typescript
// PURPOSE: TypeScript type definitions

// ============ ADVERTISER TYPES ============

export interface Advertiser {
  id: string;                     // AR17828074650563772417
  name: string;                   // Tesla Inc.
  verificationStatus: string;     // VERIFIED | NOT_VERIFIED | UNKNOWN
  location?: string;              // ISO 3166-2 code (e.g., "US")
  domain?: string;                // tesla.com
}

// ============ AD CREATIVE TYPES ============

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
  regionCode: string;             // ISO 3166-2 code (e.g., "US")
  firstShown: string;             // YYYY-MM-DD
  lastShown: string;              // YYYY-MM-DD
  timesShownLowerBound?: number;
  timesShownUpperBound?: number;
}

export interface AdCreative {
  id: string;                     // CR03335465984256376833
  advertiserId: string;           // AR17828074650563772417
  format: AdFormat;
  platforms: AdPlatform[];
  targetDomain?: string;          // Where the ad links to
  firstShown: string;             // YYYY-MM-DD
  lastShown: string;              // YYYY-MM-DD
  totalDaysShown: number;
  detailsUrl: string;             // Full URL to ad detail page
  previewUrl?: string;            // URL to ad preview/content
  regionStats: AdRegionStats[];
  
  // Content (if extractable)
  headline?: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
}

// ============ SCRAPE RESULT TYPES ============

export interface ScrapeResult {
  success: boolean;
  advertiser: Advertiser;
  ads: AdCreative[];
  totalAdsFound: number;
  scrapedAt: string;              // ISO timestamp
  errors?: string[];
}

// ============ FILTER TYPES ============

export interface ScrapeFilters {
  region?: string;                // Filter by region (e.g., "US")
  platform?: AdPlatform;          // Filter by platform
  format?: AdFormat;              // Filter by format
  startDate?: string;             // Filter by date range (YYYY-MM-DD)
  endDate?: string;
  maxResults?: number;            // Limit number of results
}

// ============ CONFIG TYPES ============

export interface ScraperConfig {
  headless: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  delays: {
    betweenPages: number;         // ms between page loads
    betweenScrolls: number;       // ms between scroll actions
    afterSearch: number;          // ms after search
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

// ============ DATABASE TYPES ============

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
  platforms: string;              // JSON array as string
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
  region_stats: string;           // JSON array as string
  created_at: string;
  updated_at: string;
}
```

---

## Phase 2: Ad Scraping

### Goal
Given an advertiser ID, scrape ALL ads they're running.

### Technical Challenges

1. **Infinite Scroll**: The ads page uses infinite scroll, not traditional pagination
2. **Dynamic Content**: Ads are loaded via JavaScript
3. **Rate Limiting**: Too many requests may trigger blocks

### Implementation Steps

#### Step 2.1: Create `src/scraper/ads.ts`

```typescript
// PURPOSE: Scrape all ads for a given advertiser

import { Page } from 'playwright';
import { AdCreative, AdFormat, AdPlatform, ScrapeFilters } from '../types';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const BASE_URL = 'https://adstransparency.google.com';

export interface AdScrapeResult {
  success: boolean;
  ads: AdCreative[];
  totalFound: number;
  errors: string[];
}

export async function scrapeAdvertiserAds(
  page: Page,
  advertiserId: string,
  filters?: ScrapeFilters
): Promise<AdScrapeResult> {
  const ads: AdCreative[] = [];
  const errors: string[] = [];
  
  try {
    logger.info(`Scraping ads for advertiser: ${advertiserId}`);
    
    // Step 1: Build URL with filters
    let url = `${BASE_URL}/advertiser/${advertiserId}`;
    const params = new URLSearchParams();
    
    if (filters?.region) {
      params.set('region', filters.region);
    }
    if (filters?.platform) {
      params.set('platform', filters.platform);
    }
    if (filters?.format) {
      params.set('format', filters.format);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    // Step 2: Navigate to advertiser page
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Step 3: Wait for initial ads to load
    await waitForAdsToLoad(page);
    
    // Step 4: Get total ad count (if displayed)
    const totalCount = await extractTotalAdCount(page);
    logger.info(`Total ads reported: ${totalCount || 'unknown'}`);
    
    // Step 5: Scroll and collect ads
    let previousAdCount = 0;
    let noNewAdsCount = 0;
    const maxNoNewAds = 3; // Stop after 3 scrolls with no new ads
    
    while (true) {
      // Extract currently visible ads
      const currentAds = await extractVisibleAds(page, advertiserId);
      
      // Add new ads to our collection
      for (const ad of currentAds) {
        if (!ads.find(a => a.id === ad.id)) {
          ads.push(ad);
        }
      }
      
      logger.info(`Collected ${ads.length} unique ads so far`);
      
      // Check if we've hit our limit
      if (filters?.maxResults && ads.length >= filters.maxResults) {
        logger.info(`Reached max results limit: ${filters.maxResults}`);
        break;
      }
      
      // Check if we're getting new ads
      if (ads.length === previousAdCount) {
        noNewAdsCount++;
        if (noNewAdsCount >= maxNoNewAds) {
          logger.info('No new ads found after scrolling. Finishing.');
          break;
        }
      } else {
        noNewAdsCount = 0;
        previousAdCount = ads.length;
      }
      
      // Scroll down to load more
      const hasMore = await scrollForMore(page);
      if (!hasMore) {
        logger.info('Reached end of ads list');
        break;
      }
      
      // Wait for new content to load
      await delay(1500);
    }
    
    return {
      success: true,
      ads: filters?.maxResults ? ads.slice(0, filters.maxResults) : ads,
      totalFound: totalCount || ads.length,
      errors
    };
    
  } catch (error) {
    logger.error('Ad scraping failed:', error);
    return {
      success: false,
      ads,
      totalFound: ads.length,
      errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

async function waitForAdsToLoad(page: Page): Promise<void> {
  // Wait for ad containers to appear
  // The exact selector will need to be determined by inspecting the actual page
  const adContainerSelectors = [
    '[data-creative-id]',
    '.creative-card',
    '[role="listitem"]',
    '.ad-card'
  ];
  
  for (const selector of adContainerSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return;
    } catch {
      continue;
    }
  }
  
  // Fallback: just wait for network to be idle
  await page.waitForLoadState('networkidle');
  await delay(2000);
}

async function extractTotalAdCount(page: Page): Promise<number | null> {
  // Look for text like "156 ads" or "Showing 156 results"
  const countPatterns = [
    /(\d+)\s*ads?/i,
    /showing\s*(\d+)/i,
    /(\d+)\s*results?/i
  ];
  
  const pageText = await page.textContent('body') || '';
  
  for (const pattern of countPatterns) {
    const match = pageText.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return null;
}

async function extractVisibleAds(
  page: Page, 
  advertiserId: string
): Promise<AdCreative[]> {
  // This function extracts ad data from the DOM
  // The exact implementation depends on the page structure
  
  return await page.evaluate((advId) => {
    const ads: any[] = [];
    
    // Try multiple selectors to find ad elements
    const adElements = document.querySelectorAll(
      '[data-creative-id], .creative-card, [role="listitem"]'
    );
    
    adElements.forEach((element) => {
      try {
        // Extract creative ID
        const creativeId = 
          element.getAttribute('data-creative-id') ||
          element.querySelector('a[href*="/creative/CR"]')?.getAttribute('href')?.match(/CR\d+/)?.[0] ||
          '';
        
        if (!creativeId) return;
        
        // Extract format from visual cues or data attributes
        let format: string = 'text';
        if (element.querySelector('video')) format = 'video';
        else if (element.querySelector('img:not([role="presentation"])')) format = 'image';
        
        // Extract dates from text content
        const text = element.textContent || '';
        const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/g) || [];
        
        // Extract link to ad details
        const detailLink = element.querySelector('a[href*="/creative/"]');
        const detailsUrl = detailLink 
          ? `https://adstransparency.google.com${detailLink.getAttribute('href')}`
          : '';
        
        ads.push({
          id: creativeId,
          advertiserId: advId,
          format: format,
          platforms: ['unknown'],
          firstShown: dateMatch[0] || '',
          lastShown: dateMatch[1] || dateMatch[0] || '',
          totalDaysShown: 0,
          detailsUrl,
          regionStats: []
        });
      } catch (e) {
        // Skip malformed elements
      }
    });
    
    return ads;
  }, advertiserId);
}

async function scrollForMore(page: Page): Promise<boolean> {
  // Scroll to bottom of page
  const previousScrollHeight = await page.evaluate(() => document.body.scrollHeight);
  
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  
  // Wait a bit for content to potentially load
  await delay(1000);
  
  // Check if page got longer (more content loaded)
  const newScrollHeight = await page.evaluate(() => document.body.scrollHeight);
  
  return newScrollHeight > previousScrollHeight;
}
```

#### Step 2.2: Create `src/scraper/parser.ts`

```typescript
// PURPOSE: Parse ad details from individual ad pages

import { Page } from 'playwright';
import { AdCreative, AdFormat, AdPlatform, AdRegionStats } from '../types';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const BASE_URL = 'https://adstransparency.google.com';

export async function parseAdDetails(
  page: Page,
  creativeId: string,
  advertiserId: string
): Promise<Partial<AdCreative>> {
  try {
    const url = `${BASE_URL}/advertiser/${advertiserId}/creative/${creativeId}`;
    
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await delay(1000);
    
    // Extract all available data from the detail page
    const details = await page.evaluate(() => {
      const data: any = {};
      
      // Extract format
      if (document.querySelector('video')) {
        data.format = 'video';
        const videoEl = document.querySelector('video');
        data.videoUrl = videoEl?.src || videoEl?.querySelector('source')?.src;
      } else if (document.querySelector('img.ad-image, img[alt*="ad" i]')) {
        data.format = 'image';
        data.imageUrl = (document.querySelector('img.ad-image, img[alt*="ad" i]') as HTMLImageElement)?.src;
      } else {
        data.format = 'text';
      }
      
      // Extract text content
      const headlineEl = document.querySelector('h1, h2, [class*="headline"]');
      data.headline = headlineEl?.textContent?.trim();
      
      const descEl = document.querySelector('[class*="description"], [class*="body"]');
      data.description = descEl?.textContent?.trim();
      
      // Extract dates
      const dateEls = document.querySelectorAll('[class*="date"], time');
      const dates = Array.from(dateEls).map(el => el.textContent?.trim());
      if (dates.length >= 2) {
        data.firstShown = dates[0];
        data.lastShown = dates[1];
      }
      
      // Extract platforms
      const platformIndicators = {
        'youtube': 'youtube',
        'search': 'google_search',
        'maps': 'google_maps',
        'play': 'google_play',
        'shopping': 'google_shopping'
      };
      
      const pageText = document.body.textContent?.toLowerCase() || '';
      data.platforms = [];
      
      for (const [keyword, platform] of Object.entries(platformIndicators)) {
        if (pageText.includes(keyword)) {
          data.platforms.push(platform);
        }
      }
      
      if (data.platforms.length === 0) {
        data.platforms = ['unknown'];
      }
      
      // Extract target domain
      const linkEl = document.querySelector('a[href*="http"]:not([href*="google.com"])');
      if (linkEl) {
        try {
          const url = new URL(linkEl.getAttribute('href') || '');
          data.targetDomain = url.hostname;
        } catch {}
      }
      
      // Extract region stats (if available)
      const regionEls = document.querySelectorAll('[class*="region"], [class*="country"]');
      data.regionStats = Array.from(regionEls).map(el => ({
        regionCode: el.getAttribute('data-region') || el.textContent?.trim() || '',
        firstShown: '',
        lastShown: ''
      })).filter(r => r.regionCode);
      
      return data;
    });
    
    return {
      id: creativeId,
      advertiserId,
      ...details
    };
    
  } catch (error) {
    logger.error(`Failed to parse ad details for ${creativeId}:`, error);
    return {
      id: creativeId,
      advertiserId
    };
  }
}

// Parse format from string to typed enum
export function parseAdFormat(format: string): AdFormat {
  const normalized = format.toLowerCase().trim();
  if (normalized === 'video') return 'video';
  if (normalized === 'image') return 'image';
  return 'text';
}

// Parse platform from string to typed enum
export function parseAdPlatform(platform: string): AdPlatform {
  const normalized = platform.toLowerCase().trim().replace(/\s+/g, '_');
  const validPlatforms: AdPlatform[] = [
    'google_search', 'youtube', 'google_maps', 
    'google_play', 'google_shopping', 'display_network'
  ];
  
  if (validPlatforms.includes(normalized as AdPlatform)) {
    return normalized as AdPlatform;
  }
  
  return 'unknown';
}
```

---

## Phase 3: Data Parsing & Storage

### Goal
Store scraped ads in SQLite for querying and deduplication.

#### Step 3.1: Create `src/database/schema.ts`

```typescript
// PURPOSE: Define SQLite database schema

export const SCHEMA = `
-- Advertisers table
CREATE TABLE IF NOT EXISTS advertisers (
  id TEXT PRIMARY KEY,                    -- AR17828074650563772417
  name TEXT NOT NULL,                     -- Tesla Inc.
  verification_status TEXT DEFAULT 'UNKNOWN',
  location TEXT,                          -- ISO country code
  domain TEXT,                            -- tesla.com
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index on domain for fast lookups
CREATE INDEX IF NOT EXISTS idx_advertisers_domain ON advertisers(domain);

-- Ad creatives table
CREATE TABLE IF NOT EXISTS ad_creatives (
  id TEXT PRIMARY KEY,                    -- CR03335465984256376833
  advertiser_id TEXT NOT NULL,            -- FK to advertisers
  format TEXT NOT NULL,                   -- text | image | video
  platforms TEXT NOT NULL,                -- JSON array: ["youtube", "google_search"]
  target_domain TEXT,                     -- Where ad links to
  first_shown TEXT,                       -- YYYY-MM-DD
  last_shown TEXT,                        -- YYYY-MM-DD
  total_days_shown INTEGER DEFAULT 0,
  details_url TEXT,
  preview_url TEXT,
  headline TEXT,
  description TEXT,
  image_url TEXT,
  video_url TEXT,
  region_stats TEXT,                      -- JSON array
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ad_creatives_advertiser ON ad_creatives(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_format ON ad_creatives(format);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_first_shown ON ad_creatives(first_shown);

-- Scrape history table (for tracking)
CREATE TABLE IF NOT EXISTS scrape_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  ads_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'IN_PROGRESS',      -- IN_PROGRESS | COMPLETED | FAILED
  error_message TEXT,
  
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id)
);
`;

export const MIGRATIONS = [
  // Future migrations can be added here
  // { version: 2, sql: 'ALTER TABLE ...' }
];
```

#### Step 3.2: Create `src/database/db.ts`

```typescript
// PURPOSE: Database operations using better-sqlite3

import Database from 'better-sqlite3';
import path from 'path';
import { SCHEMA } from './schema';
import { Advertiser, AdCreative, DbAdvertiser, DbAdCreative } from '../types';
import { logger } from '../utils/logger';

let db: Database.Database | null = null;

export function initDatabase(dbPath?: string): Database.Database {
  const finalPath = dbPath || path.join(process.cwd(), 'data', 'ads.db');
  
  // Ensure data directory exists
  const fs = require('fs');
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  db = new Database(finalPath);
  db.pragma('journal_mode = WAL');
  
  // Run schema
  db.exec(SCHEMA);
  
  logger.info(`Database initialized at: ${finalPath}`);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============ ADVERTISER OPERATIONS ============

export function upsertAdvertiser(advertiser: Advertiser): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO advertisers (id, name, verification_status, location, domain, updated_at)
    VALUES (@id, @name, @verification_status, @location, @domain, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      verification_status = @verification_status,
      location = @location,
      domain = @domain,
      updated_at = datetime('now')
  `);
  
  stmt.run({
    id: advertiser.id,
    name: advertiser.name,
    verification_status: advertiser.verificationStatus,
    location: advertiser.location || null,
    domain: advertiser.domain || null
  });
}

export function getAdvertiserByDomain(domain: string): DbAdvertiser | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM advertisers WHERE domain = ?');
  return stmt.get(domain) as DbAdvertiser | null;
}

export function getAdvertiserById(id: string): DbAdvertiser | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM advertisers WHERE id = ?');
  return stmt.get(id) as DbAdvertiser | null;
}

// ============ AD CREATIVE OPERATIONS ============

export function upsertAdCreative(ad: AdCreative): void {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO ad_creatives (
      id, advertiser_id, format, platforms, target_domain,
      first_shown, last_shown, total_days_shown, details_url,
      preview_url, headline, description, image_url, video_url,
      region_stats, updated_at
    )
    VALUES (
      @id, @advertiser_id, @format, @platforms, @target_domain,
      @first_shown, @last_shown, @total_days_shown, @details_url,
      @preview_url, @headline, @description, @image_url, @video_url,
      @region_stats, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      format = @format,
      platforms = @platforms,
      target_domain = @target_domain,
      first_shown = @first_shown,
      last_shown = @last_shown,
      total_days_shown = @total_days_shown,
      details_url = @details_url,
      preview_url = @preview_url,
      headline = @headline,
      description = @description,
      image_url = @image_url,
      video_url = @video_url,
      region_stats = @region_stats,
      updated_at = datetime('now')
  `);
  
  stmt.run({
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
    region_stats: JSON.stringify(ad.regionStats)
  });
}

export function upsertAdCreatives(ads: AdCreative[]): void {
  const db = getDatabase();
  const upsert = db.transaction((ads: AdCreative[]) => {
    for (const ad of ads) {
      upsertAdCreative(ad);
    }
  });
  upsert(ads);
}

export function getAdsByAdvertiser(advertiserId: string): DbAdCreative[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM ad_creatives WHERE advertiser_id = ? ORDER BY first_shown DESC');
  return stmt.all(advertiserId) as DbAdCreative[];
}

export function getAdCount(advertiserId: string): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM ad_creatives WHERE advertiser_id = ?');
  const result = stmt.get(advertiserId) as { count: number };
  return result.count;
}

// ============ SCRAPE HISTORY ============

export function startScrapeSession(advertiserId: string): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO scrape_history (advertiser_id, status)
    VALUES (?, 'IN_PROGRESS')
  `);
  const result = stmt.run(advertiserId);
  return result.lastInsertRowid as number;
}

export function completeScrapeSession(
  sessionId: number, 
  adsFound: number, 
  error?: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE scrape_history SET
      completed_at = datetime('now'),
      ads_found = ?,
      status = ?,
      error_message = ?
    WHERE id = ?
  `);
  
  stmt.run(
    adsFound,
    error ? 'FAILED' : 'COMPLETED',
    error || null,
    sessionId
  );
}
```

---

## Phase 4: CLI Interface

### Goal
Provide a simple command-line interface to run the scraper.

#### Step 4.1: Create `src/index.ts`

```typescript
#!/usr/bin/env node
// PURPOSE: CLI entry point

import { Command } from 'commander';
import { scrape } from './commands/scrape';
import { exportData } from './commands/export';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('google-ads-scraper')
  .description('Scrape Google Ads Transparency Center for competitor ads')
  .version('1.0.0');

// Main scrape command
program
  .command('scrape <domain>')
  .description('Scrape all ads for a given domain')
  .option('-r, --region <code>', 'Filter by region (e.g., US, GB, DE)')
  .option('-f, --format <type>', 'Filter by format (text, image, video)')
  .option('-p, --platform <name>', 'Filter by platform (youtube, google_search, etc.)')
  .option('-m, --max <number>', 'Maximum number of ads to scrape', parseInt)
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Run browser with visible window (for debugging)')
  .option('-o, --output <format>', 'Output format: json, csv, or both', 'json')
  .option('-d, --output-dir <path>', 'Output directory', './data/exports')
  .action(async (domain, options) => {
    try {
      await scrape(domain, options);
    } catch (error) {
      logger.error('Scrape failed:', error);
      process.exit(1);
    }
  });

// Export command (for already scraped data)
program
  .command('export <domain>')
  .description('Export previously scraped data')
  .option('-o, --output <format>', 'Output format: json, csv, or both', 'json')
  .option('-d, --output-dir <path>', 'Output directory', './data/exports')
  .action(async (domain, options) => {
    try {
      await exportData(domain, options);
    } catch (error) {
      logger.error('Export failed:', error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all scraped advertisers')
  .action(async () => {
    // Implementation: query database and list all advertisers
    logger.info('Listing scraped advertisers...');
    // TODO: Implement
  });

program.parse();
```

#### Step 4.2: Create `src/commands/scrape.ts`

```typescript
// PURPOSE: Main scrape command implementation

import { createBrowser, createContext, createPage } from '../scraper/browser';
import { lookupAdvertiserByDomain } from '../scraper/advertiser';
import { scrapeAdvertiserAds } from '../scraper/ads';
import { initDatabase, upsertAdvertiser, upsertAdCreatives, startScrapeSession, completeScrapeSession } from '../database/db';
import { exportToJson, exportToCsv } from '../export';
import { ScrapeFilters, ScraperConfig, Advertiser } from '../types';
import { logger } from '../utils/logger';

interface ScrapeOptions {
  region?: string;
  format?: 'text' | 'image' | 'video';
  platform?: string;
  max?: number;
  headless: boolean;
  output: 'json' | 'csv' | 'both';
  outputDir: string;
}

export async function scrape(domain: string, options: ScrapeOptions): Promise<void> {
  logger.info(`Starting scrape for domain: ${domain}`);
  logger.info(`Options: ${JSON.stringify(options)}`);
  
  // Initialize database
  initDatabase();
  
  // Create browser
  const browser = await createBrowser({ headless: options.headless });
  const context = await createContext(browser, { headless: options.headless });
  const page = await createPage(context);
  
  let sessionId: number | null = null;
  
  try {
    // Step 1: Look up advertiser
    logger.info('Step 1: Looking up advertiser...');
    const lookupResult = await lookupAdvertiserByDomain(page, domain);
    
    if (!lookupResult.success || !lookupResult.advertiser) {
      throw new Error(lookupResult.error || 'Advertiser not found');
    }
    
    const advertiser: Advertiser = {
      ...lookupResult.advertiser,
      domain
    };
    
    logger.info(`Found advertiser: ${advertiser.name} (${advertiser.id})`);
    
    // Save advertiser to database
    upsertAdvertiser(advertiser);
    
    // Start scrape session
    sessionId = startScrapeSession(advertiser.id);
    
    // Step 2: Scrape ads
    logger.info('Step 2: Scraping ads...');
    
    const filters: ScrapeFilters = {
      region: options.region,
      format: options.format,
      platform: options.platform as any,
      maxResults: options.max
    };
    
    const scrapeResult = await scrapeAdvertiserAds(page, advertiser.id, filters);
    
    if (!scrapeResult.success) {
      throw new Error(scrapeResult.errors.join(', '));
    }
    
    logger.info(`Scraped ${scrapeResult.ads.length} ads`);
    
    // Step 3: Save to database
    logger.info('Step 3: Saving to database...');
    upsertAdCreatives(scrapeResult.ads);
    
    // Step 4: Export
    logger.info('Step 4: Exporting data...');
    
    const exportData = {
      advertiser,
      ads: scrapeResult.ads,
      totalAds: scrapeResult.totalFound,
      scrapedAt: new Date().toISOString()
    };
    
    if (options.output === 'json' || options.output === 'both') {
      await exportToJson(exportData, options.outputDir, domain);
    }
    
    if (options.output === 'csv' || options.output === 'both') {
      await exportToCsv(exportData, options.outputDir, domain);
    }
    
    // Complete session
    completeScrapeSession(sessionId, scrapeResult.ads.length);
    
    logger.info('Scrape completed successfully!');
    logger.info(`Results saved to: ${options.outputDir}`);
    
  } catch (error) {
    if (sessionId) {
      completeScrapeSession(sessionId, 0, error instanceof Error ? error.message : 'Unknown error');
    }
    throw error;
  } finally {
    await browser.close();
  }
}
```

---

## Phase 5: Anti-Bot Handling

### Goal
Avoid detection and blocks from Google.

#### Step 5.1: Create `src/utils/delay.ts`

```typescript
// PURPOSE: Delay utilities with randomization

/**
 * Wait for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a random time between min and max milliseconds
 * This helps avoid detection by making requests less predictable
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

/**
 * Human-like delay for actions
 * Uses a normal distribution around the base time
 */
export function humanDelay(baseMs: number = 1000): Promise<void> {
  // Generate a random value with some variance (±50%)
  const variance = baseMs * 0.5;
  const ms = baseMs + (Math.random() - 0.5) * 2 * variance;
  return delay(Math.max(100, ms)); // Minimum 100ms
}
```

#### Step 5.2: Create `src/utils/retry.ts`

```typescript
// PURPOSE: Retry logic with exponential backoff

import { delay } from './delay';
import { logger } from './logger';

interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let currentDelay = opts.initialDelayMs;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === opts.maxAttempts) {
        logger.error(`All ${opts.maxAttempts} attempts failed`);
        break;
      }
      
      logger.warn(`Attempt ${attempt} failed: ${lastError.message}. Retrying in ${currentDelay}ms...`);
      
      await delay(currentDelay);
      
      // Increase delay with jitter
      currentDelay = Math.min(
        currentDelay * opts.backoffMultiplier + Math.random() * 1000,
        opts.maxDelayMs
      );
    }
  }
  
  throw lastError;
}

/**
 * Check if an error is retryable (network errors, rate limits, etc.)
 */
export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /rate limit/i,
    /429/,
    /503/,
    /502/
  ];
  
  return retryablePatterns.some(pattern => pattern.test(error.message));
}
```

#### Step 5.3: Create `src/utils/logger.ts`

```typescript
// PURPOSE: Simple logging utility

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS = {
  debug: '\x1b[36m',  // Cyan
  info: '\x1b[32m',   // Green
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m',  // Red
  reset: '\x1b[0m'
};

class Logger {
  private level: LogLevel = 'info';
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
  
  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const color = COLORS[level];
    const reset = COLORS.reset;
    return `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;
  }
  
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message), ...args);
    }
  }
  
  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message), ...args);
    }
  }
  
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message), ...args);
    }
  }
  
  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message), ...args);
    }
  }
}

export const logger = new Logger();
```

#### Step 5.4: Create `src/config.ts`

```typescript
// PURPOSE: Configuration constants

import { ScraperConfig } from './types';

export const DEFAULT_CONFIG: ScraperConfig = {
  headless: true,
  delays: {
    betweenPages: 2000,      // 2 seconds between page loads
    betweenScrolls: 1500,    // 1.5 seconds between scrolls
    afterSearch: 3000        // 3 seconds after search
  },
  retries: {
    maxAttempts: 3,
    backoffMs: 1000
  },
  output: {
    format: 'json',
    directory: './data/exports'
  }
};

// User agents to rotate
export const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Base URLs
export const URLS = {
  BASE: 'https://adstransparency.google.com',
  SEARCH: 'https://adstransparency.google.com/?text=',
  ADVERTISER: 'https://adstransparency.google.com/advertiser/'
};

// Region codes
export const REGIONS: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  AU: 'Australia',
  // Add more as needed
};
```

---

## Phase 6: Export & Output

#### Step 6.1: Create `src/export/json.ts`

```typescript
// PURPOSE: Export data to JSON format

import fs from 'fs';
import path from 'path';
import { ScrapeResult } from '../types';
import { logger } from '../utils/logger';

export async function exportToJson(
  data: ScrapeResult,
  outputDir: string,
  domain: string
): Promise<string> {
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedDomain = domain.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizedDomain}_${timestamp}.json`;
  const filepath = path.join(outputDir, filename);
  
  // Write file
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  
  logger.info(`Exported JSON to: ${filepath}`);
  return filepath;
}
```

#### Step 6.2: Create `src/export/csv.ts`

```typescript
// PURPOSE: Export data to CSV format

import fs from 'fs';
import path from 'path';
import { ScrapeResult, AdCreative } from '../types';
import { logger } from '../utils/logger';

export async function exportToCsv(
  data: ScrapeResult,
  outputDir: string,
  domain: string
): Promise<string> {
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedDomain = domain.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizedDomain}_${timestamp}.csv`;
  const filepath = path.join(outputDir, filename);
  
  // CSV headers
  const headers = [
    'creative_id',
    'advertiser_id',
    'advertiser_name',
    'format',
    'platforms',
    'target_domain',
    'first_shown',
    'last_shown',
    'total_days_shown',
    'headline',
    'description',
    'details_url'
  ];
  
  // Convert ads to CSV rows
  const rows = data.ads.map(ad => [
    ad.id,
    ad.advertiserId,
    data.advertiser.name,
    ad.format,
    ad.platforms.join(';'),
    ad.targetDomain || '',
    ad.firstShown,
    ad.lastShown,
    ad.totalDaysShown.toString(),
    escapeCSV(ad.headline || ''),
    escapeCSV(ad.description || ''),
    ad.detailsUrl
  ]);
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Write file
  fs.writeFileSync(filepath, csvContent);
  
  logger.info(`Exported CSV to: ${filepath}`);
  return filepath;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

#### Step 6.3: Create `src/export/index.ts`

```typescript
// PURPOSE: Re-export all export functions

export { exportToJson } from './json';
export { exportToCsv } from './csv';
```

---

## Optional: BigQuery Alternative

### Free Approach Using Google's Public Dataset

Google provides a **free public BigQuery dataset** with all ad transparency data. This is an alternative to scraping.

**Pros**:
- Completely free (1TB/month free tier)
- No anti-bot concerns
- Faster and more reliable

**Cons**:
- Data may be delayed by 1-7 days
- Limited to EU/Turkey regions
- No ad creative previews

### Usage

```sql
-- Query to get all ads for a domain
SELECT 
  advertiser_disclosed_name,
  creative_id,
  ad_format_type,
  region_stats
FROM `bigquery-public-data.google_ads_transparency_center.creative_stats`
WHERE advertiser_disclosed_name LIKE '%Tesla%'
LIMIT 100;
```

### Integration Code

```typescript
// src/bigquery/client.ts
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

export async function queryAdsByAdvertiser(advertiserName: string) {
  const query = `
    SELECT 
      advertiser_id,
      advertiser_disclosed_name,
      creative_id,
      ad_format_type,
      region_stats
    FROM \`bigquery-public-data.google_ads_transparency_center.creative_stats\`
    WHERE LOWER(advertiser_disclosed_name) LIKE LOWER(@name)
    LIMIT 1000
  `;
  
  const [rows] = await bigquery.query({
    query,
    params: { name: `%${advertiserName}%` }
  });
  
  return rows;
}
```

---

## Deployment Options

### Option 1: Local Only (Zero Cost)
- Run on your machine
- Use `--no-headless` for debugging
- Schedule with cron

### Option 2: Free Cloud (Railway/Render)
- Deploy as a containerized app
- Use headless mode
- Trigger via webhook or cron

### Option 3: GitHub Actions (Free)
```yaml
# .github/workflows/scrape.yml
name: Scheduled Scrape

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:      # Manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright
        run: npx playwright install chromium
        
      - name: Run scraper
        run: npm run scrape -- tesla.com --headless
        
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: scrape-results
          path: data/exports/
```

---

## File-by-File Implementation Guide

### Step-by-Step Order

| Order | File | Purpose | Dependencies |
|-------|------|---------|--------------|
| 1 | `package.json` | Dependencies | None |
| 2 | `tsconfig.json` | TypeScript config | None |
| 3 | `src/types/index.ts` | Type definitions | None |
| 4 | `src/utils/logger.ts` | Logging | None |
| 5 | `src/utils/delay.ts` | Delay utilities | None |
| 6 | `src/utils/retry.ts` | Retry logic | delay, logger |
| 7 | `src/config.ts` | Configuration | types |
| 8 | `src/database/schema.ts` | DB schema | None |
| 9 | `src/database/db.ts` | DB operations | schema, types, logger |
| 10 | `src/scraper/browser.ts` | Browser setup | None |
| 11 | `src/scraper/advertiser.ts` | Advertiser lookup | types, delay, logger |
| 12 | `src/scraper/ads.ts` | Ads scraping | types, delay, logger |
| 13 | `src/scraper/parser.ts` | HTML parsing | types, delay, logger |
| 14 | `src/export/json.ts` | JSON export | types, logger |
| 15 | `src/export/csv.ts` | CSV export | types, logger |
| 16 | `src/export/index.ts` | Export re-exports | json, csv |
| 17 | `src/commands/scrape.ts` | Scrape command | all above |
| 18 | `src/index.ts` | CLI entry | commands |

### Package.json Template

```json
{
  "name": "google-ads-scraper",
  "version": "1.0.0",
  "description": "Scrape Google Ads Transparency Center",
  "main": "dist/index.js",
  "bin": {
    "google-ads-scraper": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "scrape": "ts-node src/index.ts scrape"
  },
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "commander": "^11.1.0",
    "playwright": "^1.40.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/node": "^20.10.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

---

## Summary Checklist

- [ ] Phase 1: Advertiser lookup from domain
- [ ] Phase 2: Scroll-based ad scraping
- [ ] Phase 3: SQLite storage
- [ ] Phase 4: CLI interface
- [ ] Phase 5: Anti-bot stealth measures
- [ ] Phase 6: JSON/CSV export
- [ ] Optional: BigQuery integration
- [ ] Optional: GitHub Actions deployment

---

## Usage Examples

```bash
# Basic usage
npx google-ads-scraper scrape tesla.com

# With filters
npx google-ads-scraper scrape nike.com --region US --format video --max 50

# Export only (from existing data)
npx google-ads-scraper export tesla.com --output csv

# Debug mode (visible browser)
npx google-ads-scraper scrape apple.com --no-headless
```
