# Google Ads Scraper - Debugging Log

## The Problem

The Google Ads Scraper Apify actor was returning **useless data** - no headlines, no descriptions, no ad copy. Just bare metadata like timestamps and image URLs.

**Expected output (for cold outreach):**
```json
{
  "headline": "Save 30% on Powerwall 3...",
  "description": "Tesla applies federal tax credits...",
  "imageUrl": "...",
  "advertiserName": "Tesla Inc."
}
```

**Actual output:**
```json
{
  "id": "...",
  "format": "image",
  "firstShown": "...",
  "lastShown": "...",
  "imageUrl": "...",
  "headline": null,
  "description": null
}
```

---

## Timeline of Attempts

### Attempt 1: TypeScript Build Errors
**Error:** Build failed on Apify with `TS7006` errors (implicit `any` types)

**Fix:** Used `tsconfig.actor.json` instead of `tsconfig.json` for the actor build. This only compiles actor-specific files.

**Status:** ✅ Fixed

---

### Attempt 2: Navigation Timeout (120 seconds)
**Error:**
```
page.goto: Timeout 120000ms exceeded
navigating to "https://adstransparency.google.com/?region=US"
```

**Diagnosis:** Hardcoded `RESIDENTIAL` proxy group in `browser.ts` wasn't available on Starter/Personal Apify plans.

**Fix:** 
- Added `proxyConfiguration` to input schema with Apify's proxy editor
- Changed from hardcoded `groups: ['RESIDENTIAL']` to auto mode by default
- Parse proxy URL to extract username/password separately for Playwright

**Status:** ✅ Fixed

---

### Attempt 3: Proxy Auth Error
**Error:**
```
net::ERR_INVALID_AUTH_CREDENTIALS
```

**Diagnosis:** Playwright requires proxy credentials as separate fields, not embedded in URL.

**Fix:**
```typescript
const parsedUrl = new URL(proxyUrl);
proxySettings = {
  server: `${parsedUrl.protocol}//${parsedUrl.hostname}:${parsedUrl.port}`,
  username: parsedUrl.username,
  password: parsedUrl.password,
};
```

**Status:** ✅ Fixed

---

### Attempt 4: No Proxy Still Timing Out
**Error:** Even with proxy disabled, navigation still timed out.

**Diagnosis:** 
1. Headless browser detection by Google
2. Missing browser stealth configurations
3. Using bundled Chromium instead of Apify's Chrome

**Fix:**
- Added more Chrome flags for stealth
- Use `APIFY_CHROME_EXECUTABLE_PATH` for Apify's Chrome
- Updated user agents to Chrome 121/122
- Added navigator stealth overrides (webdriver, plugins, languages, permissions, platform, hardwareConcurrency, deviceMemory)

**Status:** ✅ Fixed (navigation works)

---

### Attempt 5: Advertiser Lookup Failing
**Problem:** Original advertiser lookup used search UI which was fragile:
1. Find search input
2. Type domain
3. Wait for autocomplete
4. Click result
5. Extract advertiser ID

**Fix:** Replaced with API interception approach:
- Navigate directly to `/?region=US&domain={domain}`
- Intercept `SearchService/SearchCreatives` API response
- Extract `advertiserId` and `advertiserName` from JSON response

**Status:** ✅ Fixed

---

### Attempt 6: Headline/Description Not Extracted
**Problem:** API response only contains:
- `advertiserId`, `creativeId`
- `formatType` (1=image, 2=display, 3=text)
- `imageUrl` or `textPreviewUrl` (a JS preview URL)
- Timestamps

**No headline/description in API response.**

**Diagnosis:** Google renders headline/description client-side via JavaScript preview URLs.

---

### Attempt 7: Text Preview URL Rendering (Failed)
**Approach:** Try to render the JS preview URL and extract text.

**Code:**
```typescript
await page.route(dummyUrl, async (route) => {
  const htmlWrapper = `
    <div id="${htmlParentId}"></div>
    <script>
      window['${responseCallback}'] = function(data) {
        document.getElementById('${htmlParentId}').innerHTML = data;
      };
    </script>
    <script src="${textPreviewUrl}"></script>
  `;
  await route.fulfill({ body: htmlWrapper });
});
```

**Result:** Callback never fired. The preview URL expects specific rendering context.

**Status:** ❌ Failed

---

### Attempt 8: Detail Page Iframe Extraction
**Discovery:** Navigating to ad detail pages like:
```
https://adstransparency.google.com/advertiser/{id}/creative/{creativeId}?region=US
```

The page renders the ad in **iframes**. The headline/description IS in the iframe content.

**Working locally:**
```typescript
const frames = page.frames();
for (const frame of frames) {
  const text = await frame.evaluate(() => document.body?.innerText);
  // Extract headline from text
}
```

**Local results:** Successfully extracted headlines from Tesla ads.

**Status:** ✅ Works locally

---

### Attempt 9: Iframe Extraction on Apify (Failed)
**Error on Apify:**
```
Extracted text from 0/20 ads
```

**Diagnosis:**
1. Iframes are lazy-loaded - need longer waits (8-15 seconds per page)
2. Need to scroll to trigger iframe loading
3. `networkidle` wait is unreliable on Apify
4. Each detail page takes 30-60 seconds to fully load

**Fixes tried:**
- Changed from `networkidle` to `domcontentloaded`
- Added 8-15 second delays
- Added scroll triggers
- Sequential processing instead of parallel
- Reduced to 10 ads max

**Status:** ⚠️ Works sometimes, but takes 8+ minutes for 10 ads

---

### Attempt 10: Make Headline Extraction Optional
**Realization:** Detail page navigation is inherently slow (30-60s per ad). For 20 ads = 10-20 minutes.

**Fix:** Added `extractHeadlines` toggle to input schema (default: false).

**Behavior:**
- `extractHeadlines: false` → Fast (~30 seconds total), returns basic data
- `extractHeadlines: true` → Slow (~30s per ad), includes headlines

**Status:** ✅ Implemented, but doesn't solve the core problem

---

## Current Architecture

### What Works
1. **Advertiser lookup** - API interception, fast (~5 seconds)
2. **Ad list retrieval** - API interception returns 40+ creatives in seconds
3. **Image URLs** - Available directly from API response
4. **Dates/metadata** - Available directly from API response

### What Doesn't Work Well
1. **Headline/description extraction** - Requires detail page navigation, 30-60s per ad
2. **Text preview rendering** - JS callback never fires in isolated context

---

## Existing Code That Might Help

### OCR on Image URLs
**Location:** `src/ocr/tesseract.ts`

The codebase already has OCR capability using Tesseract.js:

```typescript
export async function recognizeImageText(imageUrl: string): Promise<OcrResult> {
  const worker = await createWorker('eng');
  const result = await worker.recognize(imageUrl);
  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}
```

**This could extract text from image ads directly without detail page navigation.**

---

## The Core Problem

Google Ads Transparency Center does NOT provide headline/description in the API response. The only ways to get this data are:

1. **Detail page navigation** - Slow (30-60s per ad)
2. **OCR on image URLs** - Fast, but only works for image ads with text
3. **JS preview rendering** - Failed (callback context issues)

---

## File Locations

| Component | File |
|-----------|------|
| Actor entry point | `src/actor.ts` |
| Browser config | `src/scraper/browser.ts` |
| Advertiser lookup | `src/scraper/advertiser.ts` |
| Ad scraping | `src/scraper/ads.ts` |
| API interceptor | `src/scraper/api-interceptor.ts` |
| OCR | `src/ocr/tesseract.ts` |
| Input schema | `.actor/input_schema.json` |

---

## Apify-Specific Issues

1. **Proxy configuration** - Must use Apify's proxy system
2. **Headless detection** - Google detects headless Chrome, need stealth
3. **Iframe loading** - Lazy-loaded content needs explicit waits
4. **Timeout sensitivity** - Apify environment is slower than local

---

## Commands

```bash
# Build
npm run build

# Test locally
npx ts-node src/index.ts scrape tesla.com --max 5 --no-headless

# Push to Apify (requires interactive confirmation)
apify push
```

---

## Potential Solutions Not Yet Tried

1. **OCR on all image URLs** - Use existing Tesseract.js to extract text from image ads ✅ **NOW IMPLEMENTED**
2. ~~Batch detail page loading~~ - Replaced by OCR approach
3. **Caching** - Store extracted headlines to avoid re-extraction
4. ~~Headless Chrome alternatives~~ - Not needed with OCR approach
5. ~~Different API endpoints~~ - Not needed with OCR approach

---

## FINAL SOLUTION: OCR-Based Headline Extraction

**Status:** ✅ Implemented

Instead of slow detail page navigation (30-60s per ad), we now use OCR on image URLs:

1. API response provides `imageUrl` for each creative
2. Use Tesseract.js to extract text from the image
3. Clean up OCR text and extract headline/description
4. ~2-3 seconds per image (vs 30-60 seconds for detail page)

**Example OCR output:**
```
Confidence: 93%
Text: "Solar and Powerwall Tax Credit - Lowest Price Guaranteed"
```

**Default behavior:** `extractHeadlines: true` - OCR is enabled by default