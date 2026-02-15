import {
  getAdvertiserByDomain,
  getAdsByAdvertiser,
  updateAdCreativeText,
  upsertAdvertiser,
} from '../database/repository';
import { recognizeImageText } from '../ocr/tesseract';
import { logger } from '../utils/logger';

interface OcrOptions {
  limit?: number;
  force?: boolean;
}

export interface OcrAdResult {
  adId: string;
  headline: string | null;
  description: string | null;
}

const EMPTY_LINE_REGEX = /^[\s\W]+$/;
const SPONSORED_REGEX = /^sponsored$/i;
const URL_REGEX = /^(https?:\/\/|www\.)/i;
const HEADLINE_TRIM_REGEX = /^[^a-zA-Z]+/;
// Common OCR artifacts from logo icons (e.g. "Cc ", "s+ ", "«= ", "4» ", "#, ", "® ")
const LOGO_ARTIFACT_REGEX = /^(?:[A-Za-z]{1,2}[\s.,;:]+|[®©™«»#]+[\s.,;:]*|[^a-zA-Z0-9]{1,3}\s+)/;

function cleanOcrLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !EMPTY_LINE_REGEX.test(line))
    .filter((line) => !SPONSORED_REGEX.test(line))
    .filter((line) => !URL_REGEX.test(line));
}

function cleanHeadline(text: string): string {
  // Remove common OCR artifacts from logo icons at the start
  let cleaned = text.replace(LOGO_ARTIFACT_REGEX, '').trim();
  // Also strip leading non-alpha characters
  cleaned = cleaned.replace(HEADLINE_TRIM_REGEX, '').trim();
  return cleaned || text;
}

export interface OcrRunResult {
  processed: number;
  total: number;
  results: OcrAdResult[];
}

export async function runOcr(domain: string, options: OcrOptions): Promise<OcrRunResult> {
  const limit = options.limit && options.limit > 0 ? options.limit : 10;

  logger.info(`Running OCR for domain: ${domain}`);

  const advertiser = await getAdvertiserByDomain(domain);
  if (!advertiser) {
    throw new Error(`Advertiser not found for domain: ${domain}`);
  }

  const ads = await getAdsByAdvertiser(advertiser.id);
  // Prefer full-res imageUrl from API interceptor, fall back to previewUrl
  const eligibleAds = ads.filter((ad) => ad.imageUrl || ad.previewUrl);

  if (eligibleAds.length === 0) {
    logger.info('No ads with image URLs found for OCR.');
    return { processed: 0, total: 0, results: [] };
  }

  const targets = eligibleAds
    .filter((ad) => options.force || !ad.headline)
    .slice(0, Math.min(limit, 10));

  if (targets.length === 0) {
    logger.info('No ads eligible for OCR based on current filters.');
    return { processed: 0, total: eligibleAds.length, results: [] };
  }

  let processed = 0;
  const results: OcrAdResult[] = [];

  for (const ad of targets) {
    // Use full-res imageUrl from API when available, otherwise previewUrl
    const ocrImageUrl = ad.imageUrl || ad.previewUrl;
    if (!ocrImageUrl) {
      continue;
    }

    try {
      const result = await recognizeImageText(ocrImageUrl);
      const text = result.text.trim();
      const cleanedLines = cleanOcrLines(text);
      const headlineCandidate = cleanedLines[0] || null;
      const headline = headlineCandidate ? cleanHeadline(headlineCandidate) : null;
      // Skip the first line (headline) from description to avoid duplication
      const descriptionLines = cleanedLines.slice(1);
      const description = descriptionLines.length > 0 ? descriptionLines.join('\n') : null;

      await updateAdCreativeText(ad.id, {
        headline,
        description,
        headlineConfidence: headline ? result.confidence : null,
        descriptionConfidence: description ? result.confidence : null,
      });

      results.push({ adId: ad.id, headline, description });
      processed += 1;
      logger.info(`OCR updated ad ${ad.id}: "${headline}"`);
    } catch (error) {
      logger.warn(
        `OCR failed for ad ${ad.id}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  await upsertAdvertiser({
    id: advertiser.id,
    name: advertiser.name,
    verificationStatus: advertiser.verificationStatus,
    location: advertiser.location || undefined,
    domain: advertiser.domain || undefined,
    lastOcrRunAt: new Date().toISOString(),
  });

  logger.info(`OCR completed. Updated ${processed} ads.`);
  return { processed, total: targets.length, results };
}
