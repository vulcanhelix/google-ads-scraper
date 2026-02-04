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
      return reply.code(400).send({ 
        statusCode: 400,
        error: 'Bad Request',
        message: 'Domain is required' 
      });
    }

    // Validate maxResults
    if (body.maxResults && (body.maxResults < 1 || body.maxResults > 1000)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'maxResults must be between 1 and 1000'
      });
    }

    const options = {
      region: body.region,
      max: body.maxResults,
      headless: true,
      output: 'json' as const,
      outputDir: './data/exports',
      format: undefined,
      platform: undefined
    };

    try {
      request.log.info(`Starting scrape for domain: ${body.domain}`);
      await scrape(body.domain, options);
      
      return { 
        statusCode: 200,
        status: 'completed', 
        domain: body.domain,
        message: `Successfully scraped ads for ${body.domain}`
      };
    } catch (error) {
      request.log.error({ error, domain: body.domain }, 'Scrape failed');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for common error types
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return reply.code(408).send({ 
          statusCode: 408,
          status: 'failed',
          error: 'Request Timeout',
          message: 'Scraping took too long. Try reducing maxResults or try again later.',
          domain: body.domain
        });
      }
      
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        return reply.code(404).send({
          statusCode: 404,
          status: 'failed',
          error: 'Not Found',
          message: `No advertiser found for domain: ${body.domain}`,
          domain: body.domain
        });
      }
      
      return reply.code(500).send({ 
        statusCode: 500,
        status: 'failed',
        error: 'Scraping Error',
        message: errorMessage,
        domain: body.domain
      });
    }
  });
}
