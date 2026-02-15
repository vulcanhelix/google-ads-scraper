/**
 * API Response Interceptor for Google Ads Transparency Center
 *
 * Attaches to Playwright page response events and captures structured data
 * from the SearchService/SearchCreatives RPC endpoint, which returns ad
 * creative data in protobuf-JSON format.
 */
import { Page } from 'playwright';
import { logger } from '../utils/logger';

/** Parsed creative from the SearchCreatives API response */
export interface InterceptedCreative {
  advertiserId: string;
  creativeId: string;
  advertiserName: string;
  /** 1=image-only, 2=display, 3=text/search */
  formatType: number;
  /** For text/search ads: JS preview URL that renders the ad */
  textPreviewUrl?: string;
  /** For image ads: full-resolution image URL */
  imageUrl?: string;
  /** Image dimensions from the API */
  imageWidth?: number;
  imageHeight?: number;
  firstShownTimestamp?: number;
  lastShownTimestamp?: number;
  totalDaysShown: number;
}

/** Collector that accumulates intercepted creatives during page navigation */
export class ApiInterceptor {
  private creatives: Map<string, InterceptedCreative> = new Map();
  private _attached = false;

  /** Attach the response listener to the page. Call before navigation. */
  attach(page: Page): void {
    if (this._attached) return;
    this._attached = true;

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('SearchService/SearchCreatives')) return;

      try {
        const body = await response.text();
        const data = JSON.parse(body);
        const items = data['1'];
        if (!Array.isArray(items)) return;

        for (const item of items) {
          const creative = this.parseCreative(item);
          if (creative) {
            // Deduplicate by creativeId — keep the first occurrence
            if (!this.creatives.has(creative.creativeId)) {
              this.creatives.set(creative.creativeId, creative);
            }
          }
        }
        logger.info(`API interceptor: captured ${items.length} creatives (total unique: ${this.creatives.size})`);
      } catch (err) {
        logger.warn(`API interceptor: failed to parse SearchCreatives response: ${err}`);
      }
    });
  }

  /** Get all unique intercepted creatives */
  getCreatives(): InterceptedCreative[] {
    return Array.from(this.creatives.values());
  }

  /** Number of unique creatives captured so far */
  get size(): number {
    return this.creatives.size;
  }

  /** Parse a single creative from the protobuf-JSON structure */
  private parseCreative(item: any): InterceptedCreative | null {
    try {
      const advertiserId = item['1'];
      const creativeId = item['2'];
      if (!advertiserId || !creativeId) return null;

      const content = item['3'] || {};
      const formatType = item['4'] || 0;
      const advertiserName = item['12'] || '';
      const totalDaysShown = item['13'] || 0;

      // Parse timestamps (protobuf Timestamp: seconds in field 1)
      const firstShown = item['6'];
      const lastShown = item['7'];
      const firstShownTimestamp = firstShown ? parseInt(firstShown['1'], 10) : undefined;
      const lastShownTimestamp = lastShown ? parseInt(lastShown['1'], 10) : undefined;

      let textPreviewUrl: string | undefined;
      let imageUrl: string | undefined;
      let imageWidth: number | undefined;
      let imageHeight: number | undefined;

      // field3.1 → text/search ad with JS preview
      if (content['1']) {
        textPreviewUrl = content['1']['4'];
      }

      // field3.3 → image/display ad with img tag
      if (content['3']) {
        const imgHtml = content['3']['2'];
        if (imgHtml) {
          const srcMatch = imgHtml.match(/src="([^"]+)"/);
          const widthMatch = imgHtml.match(/width="(\d+)"/);
          const heightMatch = imgHtml.match(/height="(\d+)"/);
          if (srcMatch) imageUrl = srcMatch[1];
          if (widthMatch) imageWidth = parseInt(widthMatch[1], 10);
          if (heightMatch) imageHeight = parseInt(heightMatch[1], 10);
        }
      }

      return {
        advertiserId,
        creativeId,
        advertiserName,
        formatType,
        textPreviewUrl,
        imageUrl,
        imageWidth,
        imageHeight,
        firstShownTimestamp,
        lastShownTimestamp,
        totalDaysShown,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Convert protobuf timestamp (seconds since epoch) to ISO date string
 */
export function timestampToIso(timestampSec: number | undefined): string {
  if (!timestampSec) return '';
  return new Date(timestampSec * 1000).toISOString();
}
