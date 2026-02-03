import { delay } from './delay';
import { logger } from './logger';

interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let currentDelay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        logger.error(`All ${opts.maxAttempts} attempts failed`);
        break;
      }

      logger.warn(
        `Attempt ${attempt} failed: ${lastError.message}. Retrying in ${currentDelay}ms...`
      );

      await delay(currentDelay);

      currentDelay = Math.min(
        currentDelay * opts.backoffMultiplier + Math.random() * 1000,
        opts.maxDelayMs
      );
    }
  }

  throw lastError;
}

export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /rate limit/i,
    /429/,
    /503/,
    /502/,
  ];

  return retryablePatterns.some((pattern) => pattern.test(error.message));
}
