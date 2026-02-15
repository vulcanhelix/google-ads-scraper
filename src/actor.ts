import { Actor } from 'apify';
import { scrapeAdvertiserAds } from './scraper/ads';
import { createBrowser, createContext, createPage, ProxyConfiguration } from './scraper/browser';
import { lookupAdvertiserByDomain } from './scraper/advertiser';
import { ScrapeFilters, AdFormat, AdPlatform } from './types';

interface Input {
  domain: string;
  region?: string;
  format?: string;
  platform?: string;
  maxResults?: number;
  proxyConfiguration?: ProxyConfiguration;
}

(async () => {
  await Actor.init();

  try {
    const input = await Actor.getInput<Input>();
    if (!input || !input.domain) {
      throw new Error('Input "domain" is required');
    }

    const { 
      domain, 
      region = 'anywhere', 
      format, 
      platform, 
      maxResults = 20,
      proxyConfiguration 
    } = input;

    console.log(`Starting scrape for ${domain} (Region: ${region}, Max: ${maxResults})`);

    const browser = await createBrowser({
      headless: true,
      proxyConfiguration: proxyConfiguration || { useApifyProxy: true },
    });
    const context = await createContext(browser, { headless: true });
    const page = await createPage(context);

    try {
      const lookup = await lookupAdvertiserByDomain(page, domain);
      if (!lookup.success || !lookup.advertiser) {
        throw new Error(`Advertiser not found for domain: ${domain}`);
      }

      console.log(`Found advertiser: ${lookup.advertiser.name} (${lookup.advertiser.id})`);

      const filters: ScrapeFilters = {
        region,
        format: format as AdFormat | undefined,
        platform: platform as AdPlatform | undefined,
        maxResults,
      };

      const result = await scrapeAdvertiserAds(page, lookup.advertiser.id, filters);

      await Actor.pushData(result.ads);

      console.log(`Successfully scraped ${result.ads.length} ads`);

    } catch (error) {
      console.error('Scrape failed:', error);
      await Actor.fail(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('Actor failed:', error);
    await Actor.exit({ exitCode: 1 });
  }

  await Actor.exit();
})();
