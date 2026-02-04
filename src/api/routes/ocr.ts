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
}
