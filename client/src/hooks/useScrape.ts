import { useState } from 'react';
import { scrapeDomain } from '../lib/api';
import type { ScrapeResponse, ScrapeOptions } from '../types';

interface UseScrapeResult {
  scrape: (
    domain: string,
    apiKey: string,
    scrapeOptions: ScrapeOptions
  ) => Promise<{ scrapeResult: ScrapeResponse }>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export function useScrape(): UseScrapeResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrape = async (
    domain: string,
    apiKey: string,
    scrapeOptions: ScrapeOptions
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await scrapeDomain(domain, apiKey, scrapeOptions);

      return { scrapeResult: result };
    } catch (err: any) {
      const msg = err.message || 'Failed to scrape domain';
      setError(msg);
      return {
        scrapeResult: {
          statusCode: 500,
          status: 'failed',
          domain,
          message: msg,
        } as ScrapeResponse,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setIsLoading(false);
  };

  return { scrape, isLoading, error, reset };
}
