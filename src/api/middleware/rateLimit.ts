import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type RateEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateEntry>();

function getLimitConfig() {
  const scrapeLimit = Number.parseInt(process.env.SCRAPE_RATE_LIMIT || '5', 10);
  const ocrLimit = Number.parseInt(process.env.OCR_RATE_LIMIT || '5', 10);
  const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

  return {
    scrapeLimit: Number.isNaN(scrapeLimit) ? 5 : scrapeLimit,
    ocrLimit: Number.isNaN(ocrLimit) ? 5 : ocrLimit,
    windowMs: Number.isNaN(windowMs) ? 60000 : windowMs,
  };
}

function normalizeIp(raw: string | string[] | undefined): string | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw[0];
  return raw.split(',')[0]?.trim();
}

function getBucketKey(request: FastifyRequest, scope: string) {
  const forwarded = normalizeIp(request.headers['x-forwarded-for'] as string | undefined);
  const ip = request.ip || forwarded || 'unknown';
  return `${scope}:${ip}`;
}

function hitBucket(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    const next: RateEntry = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export function registerRateLimit(server: FastifyInstance) {
  const { scrapeLimit, ocrLimit, windowMs } = getLimitConfig();

  server.addHook('onRequest', async (request, reply) => {
    const url = request.url;

    if (url.startsWith('/health') || url.startsWith('/api/ads') || url.startsWith('/api/advertisers')) {
      return;
    }

    if (url.startsWith('/api/scrape')) {
      const key = getBucketKey(request, 'scrape');
      const result = hitBucket(key, scrapeLimit, windowMs);
      if (!result.allowed) {
        reply
          .code(429)
          .header('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000))
          .send({ error: 'Rate limit exceeded' });
        return;
      }
    }

    if (url.startsWith('/api/ocr')) {
      const key = getBucketKey(request, 'ocr');
      const result = hitBucket(key, ocrLimit, windowMs);
      if (!result.allowed) {
        reply
          .code(429)
          .header('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000))
          .send({ error: 'Rate limit exceeded' });
        return;
      }
    }
  });
}
