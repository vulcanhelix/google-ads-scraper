# PRD: Eliminate Duplicate Creative Fetching

## Problem Statement

The current implementation fetches creatives TWICE:

1. **First fetch** (advertiser lookup): `findAdvertiserByDomain()` navigates to `/?domain=example.com`, intercepts 40 creatives from the API, extracts advertiser ID, then **discards all 40 creatives**.

2. **Second fetch** (ad scraping): `scrapeAdvertiserAds()` navigates to `/advertiser/{id}`, intercepts the same 40 creatives again, then processes them.

**Impact:**
- ~60-90 seconds wasted per scrape run
- Unnecessary network requests
- Higher Apify costs (longer runtime)

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        actor.ts                              │
│                                                              │
│  const advertiser = await findAdvertiserByDomain(           │
│    page, domain                                              │
│  );                                                          │
│  // Returns: { id, name }                                    │
│  // DISCARDS: 40 intercepted creatives                       │
│                                                              │
│  const result = await scrapeAdvertiserAds(                  │
│    page, advertiser.id, filters                              │
│  );                                                          │
│  // Re-navigates, re-intercepts same 40 creatives            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Proposed Solution

Return intercepted creatives from `findAdvertiserByDomain()` and pass them to `scrapeAdvertiserAds()`. Skip second navigation if creatives are already available.

### New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        actor.ts                              │
│                                                              │
│  const lookup = await findAdvertiserByDomain(               │
│    page, domain, maxResults                                  │
│  );                                                          │
│  // Returns: { advertiser: {id, name}, creatives: [...] }    │
│                                                              │
│  const result = await scrapeAdvertiserAds(                  │
│    page,                                                     │
│    advertiser.id,                                            │
│    filters,                                                  │
│    preInterceptedCreatives: lookup.creatives  // PASS IN    │
│  );                                                          │
│  // Skips navigation if creatives already provided           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | `findAdvertiserByDomain()` must return intercepted creatives along with advertiser info | HIGH |
| FR-2 | `scrapeAdvertiserAds()` must accept optional pre-intercepted creatives | HIGH |
| FR-3 | If pre-intercepted creatives meet or exceed maxResults, skip second navigation | HIGH |
| FR-4 | If pre-intercepted creatives are insufficient, perform second navigation + scroll | MEDIUM |
| FR-5 | Advertiser matching logic (domain name scoring) must still work correctly | HIGH |
| FR-6 | OCR extraction must work with pre-intercepted creatives | HIGH |
| FR-7 | All existing output format must remain unchanged | HIGH |

### Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-1 | Reduce average scrape time by 50%+ | From ~3min to ~1.5min |
| NFR-2 | No breaking changes to API/output | Existing integrations continue to work |
| NFR-3 | Maintain retry logic for transient failures | Same 3-retry pattern |

## Affected Files

| File | Changes Required |
|------|------------------|
| `src/scraper/advertiser.ts` | Modify return type to include creatives |
| `src/scraper/ads.ts` | Accept optional pre-intercepted creatives, skip navigation if provided |
| `src/actor.ts` | Pass creatives from lookup to scrape function |
| `src/types/index.ts` | Add `AdvertiserLookupResult` type |

## Detailed Implementation

### 1. New Type Definition (`src/types/index.ts`)

```typescript
export interface AdvertiserLookupResult {
  success: boolean;
  advertiser?: {
    id: string;
    name: string;
    verificationStatus?: string;
  };
  creatives: InterceptedCreative[];  // NEW: return intercepted creatives
  alternatives?: AdvertiserInfo[];
  error?: string;
}
```

### 2. Modified `findAdvertiserByDomain()` (`src/scraper/advertiser.ts`)

```typescript
export async function findAdvertiserByDomain(
  page: Page,
  domain: string
): Promise<AdvertiserLookupResult> {
  // ... existing navigation and interception logic ...
  
  const creatives = interceptor.getCreatives();
  
  // ... existing advertiser matching logic ...
  
  return {
    success: true,
    advertiser: {
      id: bestId,
      name: bestName,
      verificationStatus: 'UNKNOWN',
    },
    creatives: creatives,  // NEW: return ALL intercepted creatives
    alternatives,
  };
}
```

### 3. Modified `scrapeAdvertiserAds()` (`src/scraper/ads.ts`)

```typescript
export async function scrapeAdvertiserAds(
  page: Page,
  advertiserId: string,
  filters?: ScrapeFilters,
  context?: BrowserContext,
  preInterceptedCreatives?: InterceptedCreative[]  // NEW parameter
): Promise<AdScrapeResult> {
  
  let creatives: InterceptedCreative[];
  let totalCount: number | null = null;

  // NEW: Use pre-intercepted creatives if sufficient
  if (preInterceptedCreatives && preInterceptedCreatives.length > 0) {
    const needed = filters?.maxResults || Infinity;
    if (preInterceptedCreatives.length >= needed) {
      logger.info(`Using ${preInterceptedCreatives.length} pre-intercepted creatives (skipping navigation)`);
      creatives = preInterceptedCreatives;
      totalCount = creatives.length;
    } else {
      // Need more creatives - do navigation + scroll
      logger.info(`Pre-intercepted ${preInterceptedCreatives.length} creatives, need ${needed} - fetching more`);
      const scrapeResult = await fetchMoreCreatives(page, advertiserId, filters);
      creatives = [...preInterceptedCreatives, ...scrapeResult.creatives];
      totalCount = scrapeResult.totalCount;
    }
  } else {
    // No pre-intercepted creatives - do full navigation
    const scrapeResult = await fetchMoreCreatives(page, advertiserId, filters);
    creatives = scrapeResult.creatives;
    totalCount = scrapeResult.totalCount;
  }

  // ... rest of OCR and conversion logic ...
}
```

### 4. Modified `actor.ts`

```typescript
const lookup = await findAdvertiserByDomain(page, input.domain);

if (!lookup.success || !lookup.advertiser) {
  await Actor.fail(`Advertiser not found for domain: ${input.domain}`);
  return;
}

logger.info(`Found advertiser: ${lookup.advertiser.name} (${lookup.advertiser.id})`);

const result = await scrapeAdvertiserAds(
  page,
  lookup.advertiser.id,
  {
    region: input.region,
    format: input.format,
    platform: input.platform,
    maxResults: input.maxResults,
    extractHeadlines: input.extractHeadlines ?? true,
  },
  context,
  lookup.creatives  // NEW: pass pre-intercepted creatives
);
```

## Edge Cases

| Case | Handling |
|------|----------|
| maxResults > initial creatives | Perform second navigation + scroll to get more |
| maxResults = 0 or undefined | Use all available creatives |
| Pre-intercepted creatives is empty array | Fall back to full navigation |
| Pre-intercepted creatives is undefined | Fall back to full navigation |
| API returns 0 creatives during lookup | Retry logic (existing), then fail gracefully |

## Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| maxResults=5, lookup returns 40 creatives | Skip second navigation, use first 5 creatives |
| maxResults=100, lookup returns 40 creatives | Do second navigation + scroll to get more |
| maxResults=5, lookup returns 0 creatives (retry succeeds) | Use creatives from retry |
| maxResults=5, lookup returns 0 creatives (all retries fail) | Return error "Advertiser not found" |
| Text ads in pre-intercepted creatives | OCR/text preview works normally |
| Image ads in pre-intercepted creatives | OCR works normally |

## Rollback Plan

If issues arise, revert to original behavior by:
1. Not passing `preInterceptedCreatives` to `scrapeAdvertiserAds()`
2. The function will fall back to full navigation

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Average scrape time (5 ads) | ~3 minutes | ~1.5 minutes |
| API calls per scrape | 2 SearchCreatives calls | 1 SearchCreatives call |
| Navigation count | 2 page navigations | 1 page navigation |

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Implementation | 30 min | Code changes |
| Testing | 15 min | Verify all scenarios |
| Deploy | 5 min | Push to GitHub + Apify |
| Verify | 10 min | Run test scrape on Apify |
