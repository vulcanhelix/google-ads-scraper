import { Page, BrowserContext } from 'playwright';
import { AdCreative, AdFormat, ScrapeFilters } from '../types';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';
import { URLS } from '../config';
import { ApiInterceptor, InterceptedCreative, timestampToIso } from './api-interceptor';

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
  const errors: string[] = [];

  try {
    logger.info(`Scraping ads for advertiser: ${advertiserId}`);

    // Set up API interceptor BEFORE navigating
    const interceptor = new ApiInterceptor();
    interceptor.attach(page);

    let url = `${URLS.ADVERTISER}${advertiserId}`;
    const params = new URLSearchParams();

    // Default to 'anywhere' so the API returns all ads globally
    // Without this, API only returns ads shown in user's auto-detected region
    params.set('region', filters?.region || 'anywhere');

    if (filters?.platform) {
      params.set('platform', filters.platform);
    }
    if (filters?.format) {
      params.set('format', filters.format);
    }

    url += `?${params.toString()}`;

    // Wait for the initial SearchCreatives API response alongside page load
    const [_response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('SearchService/SearchCreatives'),
        { timeout: 30000 }
      ).catch(() => null),
      page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      }),
    ]);

    // Give the interceptor time to process the response body
    await delay(3000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await delay(1000);

    logger.info(`After initial load: interceptor has ${interceptor.size} creatives`);

    const totalCount = await extractTotalAdCount(page);
    logger.info(`Total ads reported by page: ${totalCount || 'unknown'}`);
    logger.info(`API interceptor captured: ${interceptor.size} creatives`);

    // Scroll to trigger lazy-loaded API responses
    let previousInterceptedCount = interceptor.size;
    let noNewCount = 0;
    const maxNoNew = 5;
    let scrollAttempts = 0;
    const maxScrollAttempts = 100;

    while (scrollAttempts < maxScrollAttempts) {
      scrollAttempts++;

      if (filters?.maxResults && interceptor.size >= filters.maxResults) {
        logger.info(`Reached max results limit: ${filters.maxResults}`);
        break;
      }

      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 800));
      await delay(1500);

      if (interceptor.size > previousInterceptedCount) {
        logger.info(`API interceptor: ${interceptor.size} creatives captured`);
        noNewCount = 0;
        previousInterceptedCount = interceptor.size;
      } else {
        noNewCount++;
        if (noNewCount >= maxNoNew) {
          logger.info('No new API responses after scrolling. Finishing.');
          break;
        }
      }

      // Check if at bottom
      const atBottom = await page.evaluate(() => {
        return window.scrollY + window.innerHeight >= document.body.scrollHeight - 100;
      });

      if (atBottom) {
        await delay(2000);
        const grew = await page.evaluate(() => {
          const h = document.body.scrollHeight;
          window.scrollTo(0, h);
          return h;
        });
        await delay(2000);
        const newH = await page.evaluate(() => document.body.scrollHeight);
        if (newH <= grew) {
          logger.info('Reached end of ads list');
          break;
        }
      }
    }

    // Convert intercepted creatives to AdCreative[]
    const interceptedCreatives = interceptor.getCreatives();
    logger.info(`Total unique creatives from API: ${interceptedCreatives.length}`);

    // For text/search ads, try to extract headline/description from their preview URLs
    const context = page.context();
    const ads = await convertInterceptedAds(interceptedCreatives, advertiserId, context);

    const textAdCount = ads.filter((a) => a.headline).length;
    logger.info(`Ads with extracted headline: ${textAdCount}/${ads.length}`);

    const finalAds = filters?.maxResults ? ads.slice(0, filters.maxResults) : ads;

    return {
      success: true,
      ads: finalAds,
      totalFound: totalCount || finalAds.length,
      errors,
    };
  } catch (error) {
    logger.error('Ad scraping failed:', error);
    return {
      success: false,
      ads: [],
      totalFound: 0,
      errors: [
        ...errors,
        error instanceof Error ? error.message : 'Unknown error',
      ],
    };
  }
}

/**
 * Convert intercepted API creatives to the AdCreative type used by the rest of the app.
 * For text/search ads, loads the preview URL in a new page to extract rendered headline/description.
 */
async function convertInterceptedAds(
  creatives: InterceptedCreative[],
  advertiserId: string,
  context: BrowserContext
): Promise<AdCreative[]> {
  const ads: AdCreative[] = [];

  // Separate text ads from image ads
  const textAds = creatives.filter((c) => c.textPreviewUrl);
  const imageAds = creatives.filter((c) => !c.textPreviewUrl);

  // Extract text from text/search ad previews (batch in a single page)
  const textResults = await extractTextAdContent(textAds, context);

  for (const creative of creatives) {
    const format = mapFormatType(creative.formatType);
    const textResult = textResults.get(creative.creativeId);

    const ad: AdCreative = {
      id: creative.creativeId,
      advertiserId,
      format,
      platforms: ['unknown'],
      firstShown: timestampToIso(creative.firstShownTimestamp),
      lastShown: timestampToIso(creative.lastShownTimestamp),
      totalDaysShown: creative.totalDaysShown,
      detailsUrl: `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${creative.creativeId}?region=anywhere`,
      previewUrl: creative.imageUrl,
      imageUrl: creative.imageUrl,
      regionStats: [],
      headline: textResult?.headline,
      description: textResult?.description,
    };

    ads.push(ad);
  }

  logger.info(`Converted ${ads.length} ads (${textAds.length} text, ${imageAds.length} image)`);
  return ads;
}

/**
 * Load text/search ad preview URLs and extract rendered headline/description.
 * Processes up to 5 ads at a time for efficiency.
 */
async function extractTextAdContent(
  textAds: InterceptedCreative[],
  context: BrowserContext
): Promise<Map<string, { headline: string; description: string }>> {
  const results = new Map<string, { headline: string; description: string }>();
  if (textAds.length === 0) return results;

  logger.info(`Extracting text from ${textAds.length} text/search ad previews...`);

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < textAds.length; i += batchSize) {
    const batch = textAds.slice(i, i + batchSize);
    const promises = batch.map(async (creative) => {
      try {
        const result = await loadAndExtractAdText(creative, context);
        if (result) {
          results.set(creative.creativeId, result);
        }
      } catch (err) {
        logger.debug(`Failed to extract text for ${creative.creativeId}: ${err}`);
      }
    });
    await Promise.all(promises);
  }

  logger.info(`Extracted text from ${results.size}/${textAds.length} text ads`);
  return results;
}

/**
 * Load a single text ad preview URL and extract headline/description from the rendered content.
 */
async function loadAndExtractAdText(
  creative: InterceptedCreative,
  context: BrowserContext
): Promise<{ headline: string; description: string } | null> {
  if (!creative.textPreviewUrl) return null;

  const page = await context.newPage();
  try {
    // Check if it's a JS-based preview (standard for text ads now)
    const urlObj = new URL(creative.textPreviewUrl);
    const htmlParentId = urlObj.searchParams.get('htmlParentId');
    const responseCallback = urlObj.searchParams.get('responseCallback');

    if (htmlParentId && responseCallback) {
      // It is a JS preview. We must render it inside a wrapper HTML page.
      // We use request interception to serve this wrapper on a "valid" URL
      // to avoid 'Access is denied' errors with document.cookie on about:blank.
      const dummyUrl = 'http://dummy-render.local/ad';
      
      await page.route(dummyUrl, async (route) => {
        const htmlWrapper = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body>
            <div id="${htmlParentId}"></div>
            <script>
              // Shim document.cookie to prevent access violation errors
              try {
                Object.defineProperty(document, 'cookie', {
                  get: () => '',
                  set: () => {}
                });
              } catch(e) {}

              // Define the callback that Google's script will call
              window['${responseCallback}'] = function(data) {
                const container = document.getElementById('${htmlParentId}');
                if (!container) return;

                // Data can be a string of HTML or an object with a 'content' property
                let htmlContent = '';
                if (typeof data === 'string') {
                  htmlContent = data;
                } else if (data && data.content) {
                  htmlContent = data.content;
                }

                if (htmlContent) {
                  container.innerHTML = htmlContent;
                  // Add a marker for Playwright to wait for
                  document.body.classList.add('ad-rendered');
                }
              };
            </script>
            <script src="${creative.textPreviewUrl}"></script>
          </body>
          </html>
        `;
        
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: htmlWrapper
        });
      });

      // Navigate to the dummy URL which returns our wrapper
      await page.goto(dummyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Wait for the callback to fire and render content
      try {
        await page.waitForSelector('.ad-rendered', { timeout: 5000 });
      } catch (e) {
        // Callback didn't fire or failed, wait a bit just in case
        await delay(2000);
      }
    } else {
      // Fallback for standard HTML URLs (if any)
      await page.goto(creative.textPreviewUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
    }

    await delay(1000);

    // Extract all visible text from the rendered ad
    const textContent = await page.evaluate(() => {
      // Remove script/style elements
      const scripts = document.querySelectorAll('script, style, noscript');
      scripts.forEach((s) => s.remove());

      // Get all text nodes
      const body = document.body;
      if (!body) return { allText: '', elements: [] as Array<{ tag: string; text: string; fontSize: string }> };

      const elements: Array<{ tag: string; text: string; fontSize: string }> = [];
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
      
      let node: Node | null = walker.currentNode;
      while (node) {
        const el = node as HTMLElement;
        const text = el.textContent?.trim() || '';
        if (text && el.children.length === 0 && text.length > 1) {
          const style = window.getComputedStyle(el);
          elements.push({
            tag: el.tagName.toLowerCase(),
            text: text,
            fontSize: style.fontSize,
          });
        }
        node = walker.nextNode();
      }

      return {
        allText: body.innerText?.trim() || '',
        elements,
      };
    });

    if (!textContent.elements.length && !textContent.allText) return null;

    // Parse headline and description from extracted elements
    // Typically: largest font = headline, rest = description
    // Filter out "Sponsored", URLs, and very short text
    const meaningful = textContent.elements.filter((el) => {
      const text = el.text;
      if (text.length <= 2) return false;
      if (/^(sponsored|ad|ads)$/i.test(text)) return false;
      if (/^(https?:\/\/|www\.)/i.test(text)) return false;
      return true;
    });

    if (meaningful.length === 0) {
      // Fall back to full text
      const lines = textContent.allText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 2)
        .filter((l) => !/^(sponsored|ad|ads)$/i.test(l))
        .filter((l) => !/^(https?:\/\/|www\.)/i.test(l));

      if (lines.length === 0) return null;
      return {
        headline: lines[0],
        description: lines.slice(1).join(' '),
      };
    }

    // Sort by font size descending to find headline
    const sorted = meaningful.sort((a, b) => {
      const sizeA = parseFloat(a.fontSize) || 0;
      const sizeB = parseFloat(b.fontSize) || 0;
      return sizeB - sizeA;
    });

    const headline = sorted[0]?.text || '';
    const descParts = sorted.slice(1).map((el) => el.text);
    // Deduplicate (sometimes headline text appears in description too)
    const description = descParts
      .filter((t) => t !== headline)
      .join(' ')
      .trim();

    return {
      headline,
      description,
    };
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

function mapFormatType(formatType: number): AdFormat {
  switch (formatType) {
    case 1:
      return 'image';
    case 2:
      return 'image'; // display ads are image-based
    case 3:
      return 'text';
    default:
      return 'image';
  }
}

async function extractTotalAdCount(page: Page): Promise<number | null> {
  try {
    const pageText = (await page.textContent('body')) || '';

    const countPatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*ads?\b/i,
      /showing\s*(\d{1,3}(?:,\d{3})*)/i,
      /(\d{1,3}(?:,\d{3})*)\s*results?\b/i,
      /(\d{1,3}(?:,\d{3})*)\s*creatives?\b/i,
    ];

    for (const pattern of countPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }
    }
  } catch {
    // Ignore
  }

  return null;
}
