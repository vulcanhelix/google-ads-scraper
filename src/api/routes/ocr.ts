import { FastifyInstance } from 'fastify';
import { enqueueOcrJob, getOcrJob } from '../../ocr/queue';

export async function ocrRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      domain?: string;
      limit?: number;
      force?: boolean;
    };

    if (!body?.domain) {
      return reply.code(400).send({ error: 'domain is required' });
    }

    if (body.limit && (body.limit < 1 || body.limit > 10)) {
      return reply.code(400).send({
        error: 'limit must be between 1 and 10',
      });
    }

    const job = enqueueOcrJob(body.domain, body.limit, body.force);

    return {
      status: 'queued',
      jobId: job.id,
    };
  });

  fastify.get('/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = getOcrJob(jobId);

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }

    return job;
  });

  fastify.post('/combined', async (request, reply) => {
    const body = request.body as {
      domain?: string;
      region?: string;
      maxResults?: number;
      limit?: number;
      force?: boolean;
    };

    if (!body?.domain) {
      return reply.code(400).send({ error: 'domain is required' });
    }

    if (body.maxResults && (body.maxResults < 1 || body.maxResults > 10)) {
      return reply.code(400).send({ error: 'maxResults must be between 1 and 10' });
    }

    if (body.limit && (body.limit < 1 || body.limit > 10)) {
      return reply.code(400).send({ error: 'limit must be between 1 and 10' });
    }

    const scrapeResponse = await fastify.inject({
      method: 'POST',
      url: '/api/scrape',
      headers: request.headers as Record<string, string>,
      payload: {
        domain: body.domain,
        region: body.region,
        maxResults: body.maxResults || 10,
      },
    });

    if (scrapeResponse.statusCode >= 400) {
      return reply.code(scrapeResponse.statusCode).send({
        error: 'Scrape failed',
        message: scrapeResponse.body,
      });
    }

    const job = enqueueOcrJob(body.domain, body.limit, body.force);

    return {
      status: 'queued',
      jobId: job.id,
    };
  });
}
