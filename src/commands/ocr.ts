import {
  getAdvertiserByDomain,
  getAdsByAdvertiser,
  updateAdCreativeText,
} from '../database/repository';
import { recognizeImageText } from '../ocr/tesseract';
import { logger } from '../utils/logger';

interface OcrOptions {
  limit?: number;
  force?: boolean;
}

const EMPTY_LINE_REGEX = /^[\s\W]+$/;
const SPONSORED_REGEX = /^sponsored$/i;
const URL_REGEX = /^(https?:\/\/|www\.)/i;

function cleanOcrLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !EMPTY_LINE_REGEX.test(line))
    .filter((line) => !SPONSORED_REGEX.test(line))
    .filter((line) => !URL_REGEX.test(line));
}

export async function runOcr(domain: string, options: OcrOptions): Promise<void> {
  const limit = options.limit && options.limit > 0 ? options.limit : 10;

  logger.info(`Running OCR for domain: ${domain}`);

  const advertiser = await getAdvertiserByDomain(domain);
  if (!advertiser) {
    throw new Error(`Advertiser not found for domain: ${domain}`);
  }

  const ads = await getAdsByAdvertiser(advertiser.id);
  const eligibleAds = ads.filter((ad) => ad.previewUrl);

  if (eligibleAds.length === 0) {
    logger.info('No ads with previewUrl found for OCR.');
    return;
  }

  const targets = eligibleAds
    .filter((ad) => options.force || !ad.headline)
    .slice(0, Math.min(limit, 10));

  if (targets.length === 0) {
    logger.info('No ads eligible for OCR based on current filters.');
    return;
  }

  let processed = 0;

  for (const ad of targets) {
    if (!ad.previewUrl) {
      continue;
    }

    try {
      const result = await recognizeImageText(ad.previewUrl);
      const text = result.text.trim();
      const cleanedLines = cleanOcrLines(text);
      const headline = cleanedLines[0] || null;
      const description = cleanedLines.join('\n') || null;

      await updateAdCreativeText(ad.id, {
        headline,
        description,
        headlineConfidence: headline ? result.confidence : null,
        descriptionConfidence: description ? result.confidence : null,
      });

      processed += 1;
      logger.info(`OCR updated ad ${ad.id}`);
    } catch (error) {
      logger.warn(
        `OCR failed for ad ${ad.id}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  logger.info(`OCR completed. Updated ${processed} ads.`);
}
