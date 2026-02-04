import { FastifyInstance } from 'fastify';

function getApiKey(): string | undefined {
  const key = process.env.API_KEY || process.env.GOOGLE_ADS_SCRAPER_API_KEY;
  return key || undefined;
}

export function registerAuth(server: FastifyInstance) {
  server.addHook('onRequest', async (request, reply) => {
    const url = request.url;

    if (url.startsWith('/health') || url.startsWith('/api/ads') || url.startsWith('/api/advertisers')) {
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return;
    }

    const provided = request.headers['x-api-key'];
    if (provided !== apiKey) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
  });
}
