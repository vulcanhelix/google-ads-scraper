import { FastifyInstance } from 'fastify';
import {
  getAllAdvertisers,
  getAdvertiserById,
  getAdvertiserByDomain,
} from '../../database/repository';

export async function advertiserRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return getAllAdvertisers();
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const advertiser = await getAdvertiserById(id);
    
    if (!advertiser) {
      return reply.code(404).send({ error: 'Advertiser not found' });
    }
    return advertiser;
  });

  fastify.get('/domain/:domain', async (request, reply) => {
    const { domain } = request.params as { domain: string };
    const advertiser = await getAdvertiserByDomain(domain);
    
    if (!advertiser) {
      return reply.code(404).send({ error: 'Advertiser not found' });
    }
    return advertiser;
  });
}
