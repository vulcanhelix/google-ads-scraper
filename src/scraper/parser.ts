import { Page } from 'playwright';
import { AdCreative, AdFormat, AdPlatform } from '../types';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';
import { URLS } from '../config';

export async function parseAdDetails(
  page: Page,
  creativeId: string,
  advertiserId: string
): Promise<Partial<AdCreative>> {
  try {
    const url = `${URLS.ADVERTISER}${advertiserId}/creative/${creativeId}`;

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await delay(1000);

    const details = await page.evaluate(() => {
      const data: Record<string, unknown> = {};

      if (document.querySelector('video')) {
        data.format = 'video';
        const videoEl = document.querySelector('video');
        data.videoUrl =
          videoEl?.src || videoEl?.querySelector('source')?.getAttribute('src');
      } else if (document.querySelector('img.ad-image, img[alt*="ad" i]')) {
        data.format = 'image';
        data.imageUrl = (
          document.querySelector(
            'img.ad-image, img[alt*="ad" i]'
          ) as HTMLImageElement
        )?.src;
      } else {
        data.format = 'text';
      }

      const headlineEl = document.querySelector(
        'h1, h2, [class*="headline"]'
      );
      data.headline = headlineEl?.textContent?.trim();

      const descEl = document.querySelector(
        '[class*="description"], [class*="body"]'
      );
      data.description = descEl?.textContent?.trim();

      const dateEls = document.querySelectorAll('[class*="date"], time');
      const dates = Array.from(dateEls).map((el) => el.textContent?.trim());
      if (dates.length >= 2) {
        data.firstShown = dates[0];
        data.lastShown = dates[1];
      }

      const platformIndicators: Record<string, string> = {
        youtube: 'youtube',
        search: 'google_search',
        maps: 'google_maps',
        play: 'google_play',
        shopping: 'google_shopping',
      };

      const pageText = document.body.textContent?.toLowerCase() || '';
      const platforms: string[] = [];

      for (const [keyword, platform] of Object.entries(platformIndicators)) {
        if (pageText.includes(keyword)) {
          platforms.push(platform);
        }
      }

      data.platforms = platforms.length > 0 ? platforms : ['unknown'];

      const linkEl = document.querySelector(
        'a[href*="http"]:not([href*="google.com"])'
      );
      if (linkEl) {
        try {
          const linkUrl = new URL(linkEl.getAttribute('href') || '');
          data.targetDomain = linkUrl.hostname;
        } catch {
          // Ignore
        }
      }

      const regionEls = document.querySelectorAll(
        '[class*="region"], [class*="country"]'
      );
      data.regionStats = Array.from(regionEls)
        .map((el) => ({
          regionCode:
            el.getAttribute('data-region') || el.textContent?.trim() || '',
          firstShown: '',
          lastShown: '',
        }))
        .filter((r) => r.regionCode);

      return data;
    });

    return {
      id: creativeId,
      advertiserId,
      ...details,
    } as Partial<AdCreative>;
  } catch (error) {
    logger.error(`Failed to parse ad details for ${creativeId}:`, error);
    return {
      id: creativeId,
      advertiserId,
    };
  }
}

export function parseAdFormat(format: string): AdFormat {
  const normalized = format.toLowerCase().trim();
  if (normalized === 'video') return 'video';
  if (normalized === 'image') return 'image';
  return 'text';
}

export function parseAdPlatform(platform: string): AdPlatform {
  const normalized = platform.toLowerCase().trim().replace(/\s+/g, '_');
  const validPlatforms: AdPlatform[] = [
    'google_search',
    'youtube',
    'google_maps',
    'google_play',
    'google_shopping',
    'display_network',
  ];

  if (validPlatforms.includes(normalized as AdPlatform)) {
    return normalized as AdPlatform;
  }

  return 'unknown';
}
