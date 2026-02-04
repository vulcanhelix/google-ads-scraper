import { FastifyInstance } from 'fastify';
import {
  getAdsByAdvertiser,
  getAdCount,
} from '../../database/repository';
import prisma from '../../database/prisma';

export async function adsRoutes(fastify: FastifyInstance) {
  fastify.get('/advertiser/:advertiserId', async (request) => {
    const { advertiserId } = request.params as { advertiserId: string };
    const ads = await getAdsByAdvertiser(advertiserId);
    const count = await getAdCount(advertiserId);
    
    return {
      count,
      ads
    };
  });

  fastify.get('/advertiser/:advertiserId/ocr', async (request) => {
    const { advertiserId } = request.params as { advertiserId: string };
    const ads = await getAdsByAdvertiser(advertiserId);
    const ocrAds = ads.filter((ad) => ad.headline || ad.description);

    return {
      count: ocrAds.length,
      ads: ocrAds,
    };
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const ad = await prisma.adCreative.findUnique({
      where: { id },
      include: { advertiser: true }
    });
    
    if (!ad) {
      return reply.code(404).send({ error: 'Ad not found' });
    }
    return ad;
  });
}
