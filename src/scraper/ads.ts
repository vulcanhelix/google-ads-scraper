import { Page, BrowserContext } from 'playwright';
import { AdCreative, AdFormat, ScrapeFilters } from '../types';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';
import { URLS } from '../config';
import { ApiInterceptor, InterceptedCreative, timestampToIso } from './api-interceptor';
import { recognizeImageText, terminateWorker } from '../ocr/tesseract';

export interface AdScrapeResult {
  success: boolean;
  ads: AdCreative[];
  totalFound: number;
  errors: string[];
}

export async function scrapeAdvertiserAds(
  page: Page,
  advertiserId: string,
  filters?: ScrapeFilters,
  context?: BrowserContext
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
    const allCreatives = interceptor.getCreatives();
    logger.info(`Total unique creatives from API: ${allCreatives.length}`);

    // Trim to maxResults BEFORE OCR to avoid wasting time on ads we won't return
    const interceptedCreatives = filters?.maxResults
      ? allCreatives.slice(0, filters.maxResults)
      : allCreatives;

    // For text/search ads, try to extract headline/description from their preview URLs
    const browserContext = page.context();
    const ads = await convertInterceptedAds(
      interceptedCreatives, 
      advertiserId, 
      browserContext, 
      filters?.extractHeadlines || false
    );

    const textAdCount = ads.filter((a) => a.headline).length;
    logger.info(`Ads with extracted headline: ${textAdCount}/${ads.length}`);

    const finalAds = ads;

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
 * Uses OCR to extract text from image ads (fast, ~2-3 seconds per image).
 */
async function convertInterceptedAds(
  creatives: InterceptedCreative[],
  advertiserId: string,
  context: BrowserContext | undefined,
  extractHeadlines: boolean = false
): Promise<AdCreative[]> {
  const ads: AdCreative[] = [];
  const ocrResults = new Map<string, { headline: string; description: string }>();

  // Extract text from ads
  if (extractHeadlines) {
    logger.info(`Extracting headlines for ${creatives.length} creatives...`);

    for (let i = 0; i < creatives.length; i++) {
      const creative = creatives[i];

      // Image ads: OCR via shared worker (~3-4s per image after init)
      if (creative.imageUrl) {
        try {
          const ocrResult = await recognizeImageText(creative.imageUrl);
          if (ocrResult.text && ocrResult.confidence > 40) {
            const cleaned = cleanOcrText(ocrResult.text);
            if (cleaned) {
              ocrResults.set(creative.creativeId, cleaned);
              logger.info(`OCR [${i + 1}/${creatives.length}]: "${cleaned.headline.substring(0, 50)}..." (${ocrResult.confidence}% confidence)`);
            }
          }
        } catch (e) {
          logger.debug(`OCR failed for ${creative.creativeId}: ${e}`);
        }
      }
      // Text/search ads: render preview URL (fast timeout)
      else if (creative.textPreviewUrl && context) {
        try {
          const extracted = await extractTextFromPreviewUrl(creative.textPreviewUrl, context);
          if (extracted) {
            ocrResults.set(creative.creativeId, extracted);
            logger.info(`Preview [${i + 1}/${creatives.length}]: "${extracted.headline.substring(0, 50)}..."`);
          }
        } catch (e) {
          logger.debug(`Preview extraction failed for ${creative.creativeId}: ${e}`);
        }
      }
    }

    await terminateWorker();
  }

  for (const creative of creatives) {
    const format = mapFormatType(creative.formatType);
    const ocrResult = ocrResults.get(creative.creativeId);

    const ad: AdCreative = {
      id: creative.creativeId,
      advertiserId,
      advertiserName: creative.advertiserName || undefined,
      format,
      platforms: ['unknown'],
      firstShown: timestampToIso(creative.firstShownTimestamp),
      lastShown: timestampToIso(creative.lastShownTimestamp),
      totalDaysShown: creative.totalDaysShown,
      detailsUrl: `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${creative.creativeId}?region=anywhere`,
      previewUrl: creative.imageUrl || creative.textPreviewUrl,
      imageUrl: creative.imageUrl,
      regionStats: [],
      headline: ocrResult?.headline,
      description: ocrResult?.description,
    };

    ads.push(ad);
  }

  const withHeadlines = ads.filter(a => a.headline).length;
  logger.info(`Converted ${ads.length} ads (${withHeadlines} with headline extracted via OCR)`);
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

/**
 * Clean raw OCR text from a Google Ads screenshot.
 * The screenshot contains browser chrome (favicon, URL bar, "Sponsored" label)
 * that produces noise like `"k`, `ww`, `(0)`, `®` before the actual ad copy.
 */
function cleanOcrText(rawText: string): { headline: string; description: string } | null {
  const lines = rawText.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const cleanedLines: string[] = [];
  for (const line of lines) {
    // Skip pure noise lines
    if (line.length <= 3) continue;
    if (/^Sponsored$/i.test(line)) continue;
    if (/^Sponsorowane$/i.test(line)) continue;
    if (/^Sponsoris/i.test(line)) continue;
    if (/^Gesponsert$/i.test(line)) continue;
    if (/^Sponsrad$/i.test(line)) continue;
    if (/^Patrocinado$/i.test(line)) continue;
    if (/^Sponsoriz/i.test(line)) continue;
    if (/^Ad$/i.test(line)) continue;
    if (/^\.*$/.test(line)) continue;

    // Clean leading OCR noise: favicon artifacts, symbols, parenthetical junk
    let cleaned = line
      .replace(/^["""\u201C\u201D"'`~=)\]}>|*#@!¢£€¥§©®™•·°±×÷]+\s*/g, '') // leading symbols
      .replace(/^\(?[0-9oO]\)\s*/g, '')   // (0), (O) - favicon circle artifacts
      .replace(/^[0-9]\s+(?=[A-Z])/g, '') // lone digit before a word (favicon artifact)
      .replace(/^[a-zA-Z]{1,2}\s+(?=\S)/, (match) => {  // lone 1-2 char prefix like "ww ", "k "
        // Only strip if it looks like noise, not a real word
        const prefix = match.trim().toLowerCase();
        if (['a', 'i', 'an', 'at', 'be', 'by', 'do', 'go', 'if', 'in', 'is', 'it', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we'].includes(prefix)) {
          return match; // keep real words
        }
        return ''; // strip noise
      })
      .replace(/^®\s*/g, '')              // registered trademark
      .replace(/^[Ee][Oo]\)\s*/g, '')     // Eo) artifact
      .replace(/^[Pp][Oo]\)\s*/g, '')     // Po) artifact
      .trim();

    // Skip URL-only lines
    if (/^(https?:\/\/|www\.)\S+$/i.test(cleaned)) continue;
    // Skip lines that are just a URL with minor prefix
    if (/^[^\s]{0,3}\s*(https?:\/\/|www\.)\S+$/i.test(cleaned)) continue;

    if (cleaned.length > 3) {
      cleanedLines.push(cleaned);
    }
  }

  if (cleanedLines.length === 0) return null;

  // First meaningful line is the headline
  const headline = cleanedLines[0];

  // Remaining lines form the description — also clean URL noise from within
  const description = cleanedLines.slice(1)
    .map(l => l.replace(/^[^\s]{0,3}\s*(www\.\S+\/?\s*)/i, '').trim()) // strip leading URL fragments
    .filter(l => l.length > 5 && l !== headline)
    .join(' ')
    .substring(0, 300);

  return { headline, description };
}

/**
 * Extract headline/description from a text ad's preview URL by rendering it in a browser page.
 * The textPreviewUrl is a JS-rendered preview of a Google search ad.
 */
async function extractTextFromPreviewUrl(
  previewUrl: string,
  context: BrowserContext
): Promise<{ headline: string; description: string } | null> {
  const page = await context.newPage();
  try {
    await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await delay(1000);

    // Try to find ad content in iframes first, then fall back to main page
    let text = '';
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const frameText = await frame.evaluate(() => document.body?.innerText || '').catch(() => '');
        // Skip frames with JS source code or boilerplate
        if (frameText && frameText.length > 10 && 
            !frameText.includes('da=ca(this)') &&
            !frameText.includes('function()') &&
            !frameText.includes('window.wiz')) {
          if (frameText.length > text.length) text = frameText;
        }
      } catch {}
    }
    if (!text || text.length < 10) {
      text = await page.evaluate(() => document.body?.innerText || '');
    }
    if (!text || text.length < 10) return null;

    // Skip if it looks like raw JS source
    if (text.includes('da=ca(this)') || text.includes('var ') || text.match(/^[\{\[]/)) return null;

    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 3)
      .filter(l => !l.match(/^Sponsored$/i))
      .filter(l => !l.match(/^Ad$/i))
      .filter(l => !l.match(/^https?:\/\//i))
      .filter(l => !l.match(/^www\./i))
      .filter(l => !l.includes('googMsgType'))
      .filter(l => !l.includes('function('))
      .filter(l => !l.includes('var '))
      .filter(l => l.length < 200);

    if (lines.length === 0) return null;

    const headline = lines[0];
    const description = lines.slice(1)
      .filter(l => l !== headline && l.length > 5)
      .join(' ')
      .substring(0, 300);

    return { headline, description };
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
