import { FastifyInstance } from 'fastify';
import { scrape } from '../../commands/scrape';

interface ScrapeBody {
  domain: string;
  region?: string;
  maxResults?: number;
}

export async function scrapeRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (request, reply) => {
    const body = request.body as ScrapeBody;
    
    if (!body.domain) {
      return reply.code(400).send({ error: 'Domain is required' });
    }

    // Run scraping in background to avoid blocking the request
    // In a production app, we would use a job queue like Bull
    const options = {
      region: body.region,
      max: body.maxResults,
      headless: true,
      output: 'json' as const,
      outputDir: './data/exports',
      format: undefined,
      platform: undefined
    };

    // We start the scrape but return immediately with a "job started" status
    // For V1, we'll await it to ensure it works, but catch errors
    try {
      await scrape(body.domain, options);
      return { status: 'completed', domain: body.domain };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
}
