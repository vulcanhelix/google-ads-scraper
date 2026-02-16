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
 * Extract headline/description from ALL ads by navigating to detail pages.
 */
async function convertInterceptedAds(
  creatives: InterceptedCreative[],
  advertiserId: string,
  context: BrowserContext
): Promise<AdCreative[]> {
  const ads: AdCreative[] = [];

  // Extract text from ALL ads via detail pages
  const textResults = await extractTextFromAllAds(creatives, context);

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

  const withHeadlines = ads.filter(a => a.headline).length;
  logger.info(`Converted ${ads.length} ads (${withHeadlines} with headline extracted)`);
  return ads;
}

/**
 * Extract headline/description by navigating to ad detail page and reading iframe content.
 * Processes ALL ads, not just text format.
 */
async function extractTextFromAllAds(
  creatives: InterceptedCreative[],
  context: BrowserContext
): Promise<Map<string, { headline: string; description: string }>> {
  const results = new Map<string, { headline: string; description: string }>();
  if (creatives.length === 0) return results;

  // Only extract from first 10 ads (to avoid massive timeouts)
  const maxAds = Math.min(creatives.length, 10);
  
  logger.info(`Extracting headline/description from ${maxAds} ads via detail pages...`);

  // Process sequentially to avoid overwhelming the browser
  for (let i = 0; i < maxAds; i++) {
    try {
      const result = await extractFromDetailPage(creatives[i], context);
      if (result) {
        results.set(creatives[i].creativeId, result);
        logger.info(`Extracted headline from ad ${i + 1}/${maxAds}: ${result.headline.substring(0, 50)}...`);
      }
    } catch (err) {
      logger.debug(`Failed to extract text for ${creatives[i].creativeId}: ${err}`);
    }
  }

  logger.info(`Extracted text from ${results.size}/${maxAds} ads`);
  return results;
}

async function extractFromDetailPage(
  creative: InterceptedCreative,
  context: BrowserContext
): Promise<{ headline: string; description: string } | null> {
  const page = await context.newPage();
  try {
    const detailUrl = `https://adstransparency.google.com/advertiser/${creative.advertiserId}/creative/${creative.creativeId}?region=US`;
    
    // Use domcontentloaded instead of networkidle (more reliable on Apify)
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
    
    // Wait for page to settle
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to wait for networkidle but don't fail if it times out
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Wait for lazy-loaded iframe content
    await new Promise(r => setTimeout(r, 5000));
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, 500)).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => window.scrollTo(0, 1000)).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const frames = page.frames();
    let bestResult: { headline: string; description: string } | null = null;
    
    for (const frame of frames) {
      try {
        const text = await frame.evaluate(() => document.body?.innerText || '').catch(() => '');
        if (!text || text.length < 20) continue;

        // Skip if it looks like CSS or main page content
        if (text.includes('Ads Transparency Centre') || 
            text.includes('function()') ||
            text.includes('html,body') ||
            text.includes('window.wiz_progress') ||
            text.includes('HTML,BODY') ||
            text.includes('var adData') ||
            text.includes('googMsgType')) {
          continue;
        }

        const cleanText = text.replace(/\s+/g, ' ').trim();
        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        
        // Filter out noise
        const filtered = lines.filter(l => 
          !l.startsWith('Sponsored') && 
          !l.startsWith('Visit') &&
          !l.startsWith('Skip') &&
          !l.startsWith('Install') &&
          !l.startsWith('[Price]') &&
          !l.match(/^\d{2}:\d{2}$/) &&
          !l.match(/^\d+\s*ads?$/i) &&
          !l.includes('function()') &&
          !l.includes('window.wiz') &&
          !l.includes('html,body') &&
          !l.includes('HTML,BODY') &&
          !l.match(/^{.*}$/) &&
          l.length > 10
        );
        
        if (filtered.length > 0) {
          const headline = filtered[0];
          const description = filtered.slice(1)
            .filter(l => l !== headline && l.length > 5)
            .join(' ')
            .substring(0, 300);
          
          if (headline && headline.length > 8) {
            if (!bestResult || headline.length > bestResult.headline.length) {
              bestResult = { headline, description };
            }
          }
        }
      } catch (e) {}
    }

    return bestResult;
  } catch (e) {
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
