# TDD: Eliminate Duplicate Creative Fetching

## Overview

This Test-Driven Development document provides step-by-step verification to ensure the implementation of PRD-eliminate-duplicate-fetch.md is executed correctly without breaking existing functionality.

## Pre-Implementation Checklist

Run these tests BEFORE making any changes to establish baseline:

```bash
# 1. Build must pass
npm run build

# 2. Type check must pass
npx tsc --noEmit

# 3. Local test must work (quick smoke test)
npx ts-node src/index.ts scrape tesla.com --max 3 --no-headless
```

**Record baseline timing:**
- [ ] Build time: _____ seconds
- [ ] Local scrape time: _____ seconds
- [ ] Apify scrape time (from last run): 2 min 46 seconds

---

## Test Cases

### TC-1: Type Definitions

**File:** `src/types/index.ts`

**Test Steps:**
1. Open `src/types/index.ts`
2. Verify `AdvertiserLookupResult` interface exists
3. Verify it contains:
   - `success: boolean`
   - `advertiser?: { id, name, verificationStatus? }`
   - `creatives: InterceptedCreative[]`
   - `alternatives?: AdvertiserInfo[]`
   - `error?: string`

**Verification Command:**
```bash
grep -A 10 "AdvertiserLookupResult" src/types/index.ts
```

**Expected Output:**
```typescript
export interface AdvertiserLookupResult {
  success: boolean;
  advertiser?: {
    id: string;
    name: string;
    verificationStatus?: string;
  };
  creatives: InterceptedCreative[];
  alternatives?: AdvertiserInfo[];
  error?: string;
}
```

**Pass/Fail:** [ ]

---

### TC-2: findAdvertiserByDomain Returns Creatives

**File:** `src/scraper/advertiser.ts`

**Test Steps:**
1. Open `src/scraper/advertiser.ts`
2. Verify return type is `AdvertiserLookupResult`
3. Verify function returns `creatives` array in success response
4. Verify creatives are from `interceptor.getCreatives()`

**Verification Command:**
```bash
grep -A 5 "return {" src/scraper/advertiser.ts | head -20
```

**Expected to see:**
- `creatives: creatives` or `creatives,` in return statement
- Function signature includes `Promise<AdvertiserLookupResult>`

**Pass/Fail:** [ ]

---

### TC-3: scrapeAdvertiserAds Accepts Pre-Intercepted Creatives

**File:** `src/scraper/ads.ts`

**Test Steps:**
1. Open `src/scraper/ads.ts`
2. Verify function signature includes `preInterceptedCreatives` parameter
3. Verify function checks if pre-intercepted creatives are sufficient
4. Verify function skips navigation when creatives are sufficient

**Verification Command:**
```bash
grep -A 3 "export async function scrapeAdvertiserAds" src/scraper/ads.ts
```

**Expected to see:**
```typescript
export async function scrapeAdvertiserAds(
  page: Page,
  advertiserId: string,
  filters?: ScrapeFilters,
  context?: BrowserContext,
  preInterceptedCreatives?: InterceptedCreative[]
): Promise<AdScrapeResult>
```

**Pass/Fail:** [ ]

---

### TC-4: Navigation Skip Logic

**File:** `src/scraper/ads.ts`

**Test Steps:**
1. Search for log message indicating navigation skip
2. Verify condition checks `preInterceptedCreatives.length >= needed`

**Verification Command:**
```bash
grep -A 3 "skipping navigation" src/scraper/ads.ts
```

**Expected to see:**
- Log message: `Using X pre-intercepted creatives (skipping navigation)`
- Condition that skips `page.goto()` when sufficient creatives exist

**Pass/Fail:** [ ]

---

### TC-5: Actor Passes Creatives

**File:** `src/actor.ts`

**Test Steps:**
1. Open `src/actor.ts`
2. Verify `scrapeAdvertiserAds()` call includes `lookup.creatives` parameter

**Verification Command:**
```bash
grep -A 10 "scrapeAdvertiserAds" src/actor.ts
```

**Expected to see:**
```typescript
const result = await scrapeAdvertiserAds(
  page,
  lookup.advertiser.id,
  { ... },
  context,
  lookup.creatives  // This line must exist
);
```

**Pass/Fail:** [ ]

---

### TC-6: Build Passes

**Test Steps:**
```bash
npm run build
```

**Expected:** No errors

**Pass/Fail:** [ ]

---

### TC-7: Type Check Passes

**Test Steps:**
```bash
npx tsc --noEmit
```

**Expected:** No errors

**Pass/Fail:** [ ]

---

### TC-8: Local Scrape Test

**Test Steps:**
```bash
npx ts-node src/index.ts scrape knowify.com --max 5 --no-headless
```

**Expected Output:**
1. Look for log: `Using X pre-intercepted creatives (skipping navigation)`
2. Verify ads are returned with headlines
3. Verify no second navigation to `/advertiser/...`

**Check for in output:**
```
[INFO] Found advertiser: Knowify, Inc.
[INFO] Using X pre-intercepted creatives (skipping navigation)  <-- NEW LOG
[INFO] Extracting headlines for 5 creatives...
```

**Record timing:**
- Scrape completed in: _____ seconds

**Pass/Fail:** [ ]

---

### TC-9: Edge Case - maxResults > Initial Creatives

**Test Steps:**
```bash
npx ts-node src/index.ts scrape knowify.com --max 100 --no-headless
```

**Expected Output:**
1. Should see log: `Pre-intercepted X creatives, need 100 - fetching more`
2. Should perform second navigation
3. Should return up to 100 ads

**Pass/Fail:** [ ]

---

### TC-10: Output Format Unchanged

**Test Steps:**
1. Run scrape and save output
2. Compare output structure to previous run

**Expected Fields:**
- `id`
- `advertiserId`
- `advertiserName`
- `format`
- `platforms`
- `firstShown`
- `lastShown`
- `totalDaysShown`
- `detailsUrl`
- `previewUrl`
- `imageUrl` (for image ads)
- `headline`
- `description`

**Pass/Fail:** [ ]

---

## Post-Implementation Verification

### Apify Deployment Test

After pushing to Apify:

1. Run test scrape on Apify for knowify.com, max=5
2. Check logs for `skipping navigation` message
3. Verify runtime is reduced by ~50%

**Expected Logs:**
```
Starting scrape for knowify.com (Region: anywhere, Max: 5, ExtractHeadlines: true)
Looking up advertiser for domain: knowify.com
Lookup attempt 1/3...
API interceptor: captured 40 creatives
Primary advertiser: Knowify, Inc.
Using 40 pre-intercepted creatives (skipping navigation)  <-- KEY LOG
Extracting headlines for 5 creatives...
OCR [1/5]: "..."
Successfully scraped 5 ads
```

**Record timing:**
- Apify runtime: _____ seconds
- Improvement from baseline: _____ %

**Pass/Fail:** [ ]

---

## Regression Tests

### R-1: Advertiser Matching Still Works

**Test:** Run against hubspot.com (from Phase 6 Issue 6.4)

```bash
npx ts-node src/index.ts scrape hubspot.com --max 5 --no-headless
```

**Expected:** Should return HubSpot ads, NOT Authsignal ads

**Pass/Fail:** [ ]

### R-2: Retry Logic Still Works

**Test:** This can only be verified on Apify if transient failure occurs.

**Expected:** If first lookup returns 0 creatives, should retry up to 3 times

**Pass/Fail:** [ ]

### R-3: OCR Still Works

**Test:** Verify headlines are extracted from image ads

**Expected:** Image ads should have non-null `headline` field

**Pass/Fail:** [ ]

### R-4: Text Ads Still Process

**Test:** Verify text ads are included in output (even if no headline)

**Expected:** Text ads should appear in output with `format: "text"`

**Pass/Fail:** [ ]

---

## Rollback Procedure

If any test fails critically:

```bash
# Revert to previous commit
git revert HEAD

# Rebuild
npm run build

# Re-push to Apify
```

---

## Sign-Off

| Step | Status | Initials | Date |
|------|--------|----------|------|
| Pre-implementation tests | [ ] | | |
| TC-1 through TC-10 | [ ] | | |
| Apify deployment test | [ ] | | |
| Regression tests | [ ] | | |
| Final sign-off | [ ] | | |

---

## Debug Commands

If tests fail, use these commands to diagnose:

```bash
# Check if types are correct
npx tsc --noEmit 2>&1 | head -50

# Check function signatures
grep -n "async function" src/scraper/*.ts

# Check return statements
grep -n "return {" src/scraper/advertiser.ts src/scraper/ads.ts

# Check actor.ts for correct parameter passing
cat src/actor.ts | grep -A 20 "scrapeAdvertiserAds"

# Run with debug logging
DEBUG=* npx ts-node src/index.ts scrape knowify.com --max 3 --no-headless
```
