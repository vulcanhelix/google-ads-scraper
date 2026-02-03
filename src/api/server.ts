import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { advertiserRoutes } from './routes/advertisers';
import { adsRoutes } from './routes/ads';
import { scrapeRoutes } from './routes/scrape';

const server: FastifyInstance = Fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: true });

  // Register routes
  await server.register(advertiserRoutes, { prefix: '/api/advertisers' });
  await server.register(adsRoutes, { prefix: '/api/ads' });
  await server.register(scrapeRoutes, { prefix: '/api/scrape' });

  // Health check
  server.get('/health', async () => ({ status: 'ok' }));

  const port = parseInt(process.env.PORT || '3000', 10);
  
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`API running on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
