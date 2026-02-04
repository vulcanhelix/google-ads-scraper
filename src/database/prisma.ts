import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Test database connection
export async function testDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    return { connected: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Database connection failed:', errorMessage);
    
    if (errorMessage.includes('Authentication failed')) {
      console.error('💡 Hint: Check that DATABASE_URL is set correctly in environment variables');
    }
    
    return { connected: false, error: errorMessage };
  }
}

export default prisma;
