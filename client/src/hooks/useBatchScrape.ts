import { useState } from 'react';
import { batchScrapeDomains } from '../lib/api';
import type { BatchScrapeResult, BatchProgress, ScrapeOptions } from '../types';

interface UseBatchScrapeResult {
  batchScrape: (
    domains: string[],
    apiKey: string,
    options: ScrapeOptions
  ) => Promise<BatchScrapeResult>;
  progress: BatchProgress | null;
  isProcessing: boolean;
  error: string | null;
  reset: () => void;
}

export function useBatchScrape(): UseBatchScrapeResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const batchScrape = async (
    domains: string[],
    apiKey: string,
    options: ScrapeOptions
  ): Promise<BatchScrapeResult> => {
    setIsProcessing(true);
    setProgress(null);
    setError(null);

    try {
      const result = await batchScrapeDomains(
        domains,
        apiKey,
        options,
        (progress) => {
          setProgress(progress);
        }
      );

      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to batch scrape');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setProgress(null);
    setError(null);
    setIsProcessing(false);
  };

  return { batchScrape, progress, isProcessing, error, reset };
}
