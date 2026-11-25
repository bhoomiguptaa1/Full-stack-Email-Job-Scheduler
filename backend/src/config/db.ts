import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB(): Promise<boolean> {
  try {
    await prisma.$connect();
    logger.info('[PostgreSQL] Connected successfully via Prisma.');
    return true;
  } catch (error) {
    logger.warn('[PostgreSQL] Connection warning. Ensure PostgreSQL is running.', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
