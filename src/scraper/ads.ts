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

    // Optimizations: Block unnecessary resources to speed up load
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,eot}', (route) => route.abort());

    // Wait for the initial SearchCreatives API response alongside page load
    const [_response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('SearchService/SearchCreatives'),
        { timeout: 120000 }
      ).catch(() => null),
      page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
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
 * Extract headline/description by navigating to ad detail page and reading iframe content.
 */
async function extractTextAdContent(
  textAds: InterceptedCreative[],
  context: BrowserContext
): Promise<Map<string, { headline: string; description: string }>> {
  const results = new Map<string, { headline: string; description: string }>();
  if (textAds.length === 0) return results;

  logger.info(`Extracting text from ${textAds.length} text/search ad previews via detail pages...`);

  for (const creative of textAds) {
    try {
      const result = await extractFromDetailPage(creative, context);
      if (result) {
        results.set(creative.creativeId, result);
      }
    } catch (err) {
      logger.debug(`Failed to extract text for ${creative.creativeId}: ${err}`);
    }
  }

  logger.info(`Extracted text from ${results.size}/${textAds.length} text ads`);
  return results;
}

async function extractFromDetailPage(
  creative: InterceptedCreative,
  context: BrowserContext
): Promise<{ headline: string; description: string } | null> {
  const page = await context.newPage();
  try {
    const detailUrl = `https://adstransparency.google.com/advertiser/${creative.advertiserId}/creative/${creative.creativeId}?region=US`;
    
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const frames = page.frames();
    for (const frame of frames) {
      try {
        const text = await frame.evaluate(() => document.body?.innerText || '').catch(() => '');
        if (!text || text.length < 20) continue;

        const cleanText = text.replace(/\s+/g, ' ').trim();
        
        if (cleanText.includes('Sponsored') && !cleanText.includes('function()')) {
          const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
          
          const filtered = lines.filter(l => 
            !l.startsWith('Sponsored') && 
            !l.startsWith('Visit') &&
            !l.match(/^\d{2}:\d{2}$/) &&
            !l.includes('function()') &&
            l.length > 5
          );
          
          if (filtered.length > 0) {
            const headline = filtered[0].replace(/^(Sponsored\s+)?(\d{2}:\d{2}\s+)?/, '').trim();
            const description = filtered.slice(1)
              .filter(l => l !== headline && l.length > 5)
              .join(' ')
              .substring(0, 200);
            
            if (headline && headline.length > 3) {
              return { headline, description };
            }
          }
        }
      } catch (e) {}
    }

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
