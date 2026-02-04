import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { advertiserRoutes } from './routes/advertisers';
import { adsRoutes } from './routes/ads';
import { scrapeRoutes } from './routes/scrape';
import { ocrRoutes } from './routes/ocr';
import { registerRateLimit } from './middleware/rateLimit';
import { registerAuth } from './middleware/auth';
import { testDatabaseConnection } from '../database/prisma';

const server: FastifyInstance = Fastify({ 
  logger: true,
  requestTimeout: 60000, // 60 second timeout for scraping operations
});

async function start() {
  // Test database connection on startup
  const dbStatus = await testDatabaseConnection();
  if (!dbStatus.connected) {
    console.warn('⚠️  Starting server without database connection');
  }

  await server.register(cors, { origin: true });

  registerAuth(server);
  registerRateLimit(server);

  // Global error handler - ensures all errors return JSON
  server.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    server.log.error(error);

    // Handle specific error types
    if (error.statusCode === 404) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: error.message || 'Route not found',
      });
    }

    // Database errors
    if (error.message?.includes('Authentication failed')) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Database Error',
        message: 'Database connection failed. Please check DATABASE_URL configuration.',
      });
    }

    // Timeout errors
    if (error.code === 'FST_ERR_REQ_TIMEOUT') {
      return reply.status(408).send({
        statusCode: 408,
        error: 'Request Timeout',
        message: 'Request took too long to complete. Try reducing maxResults or try again later.',
      });
    }

    // Default error response
    return reply.status(error.statusCode || 500).send({
      statusCode: error.statusCode || 500,
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
    });
  });

  // Register routes
  await server.register(advertiserRoutes, { prefix: '/api/advertisers' });
  await server.register(adsRoutes, { prefix: '/api/ads' });
  await server.register(scrapeRoutes, { prefix: '/api/scrape' });
  await server.register(ocrRoutes, { prefix: '/api/ocr' });

  // Enhanced health check with database status
  server.get('/health', async () => {
    const dbStatus = await testDatabaseConnection();
    return {
      status: 'ok',
      database: dbStatus.connected ? 'connected' : 'disconnected',
      ...(dbStatus.error && { databaseError: dbStatus.error }),
    };
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API running on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
