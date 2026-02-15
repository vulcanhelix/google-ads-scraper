import { FastifyInstance } from 'fastify';
import { scrape } from '../../commands/scrape';
import { getAdvertiserByDomain, getAdsByAdvertiser } from '../../database/repository';

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

    // Validate maxResults — allow up to 100 now that API interception captures more
    if (body.maxResults && (body.maxResults < 1 || body.maxResults > 100)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'maxResults must be between 1 and 100'
      });
    }

    const options = {
      region: body.region,
      max: body.maxResults || 20,
      headless: true,
      output: 'json' as const,
      outputDir: './data/exports',
      format: undefined,
      platform: undefined,
    };

    try {
      request.log.info(`Starting scrape for domain: ${body.domain}`);
      await scrape(body.domain, options);
      
      // Fetch the scraped data to return inline
      const advertiser = await getAdvertiserByDomain(body.domain);
      let ads: any[] = [];
      let adSummary = null;

      if (advertiser) {
        ads = await getAdsByAdvertiser(advertiser.id);

        const textAds = ads.filter((a) => a.format === 'text');
        const imageAds = ads.filter((a) => a.format === 'image');
        const videoAds = ads.filter((a) => a.format === 'video');
        const withHeadline = ads.filter((a) => a.headline);
        const maxDays = ads.reduce((max, a) => Math.max(max, a.totalDaysShown || 0), 0);

        adSummary = {
          totalAds: ads.length,
          textAds: textAds.length,
          imageAds: imageAds.length,
          videoAds: videoAds.length,
          adsWithHeadline: withHeadline.length,
          longestRunningDays: maxDays,
        };
      }

      return { 
        statusCode: 200,
        status: 'completed', 
        domain: body.domain,
        message: `Successfully scraped ads for ${body.domain}`,
        advertiser: advertiser || null,
        summary: adSummary,
        ads,
      };
    } catch (error) {
      request.log.error({ error, domain: body.domain }, 'Scrape failed');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
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
