import Redis from 'ioredis';
import { ENV } from './env';
import { logger } from '../utils/logger';

export const redisConnection = new Redis({
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  password: ENV.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 300, 3000);
  },
});

redisConnection.on('connect', () => {
  logger.info('[Redis] Connected successfully.');
});

redisConnection.on('error', (err) => {
  logger.warn('[Redis] Connection warning', { error: err.message });
});

export async function disconnectRedis(): Promise<void> {
  if (redisConnection.status !== 'end') {
    await redisConnection.quit().catch(() => {
      redisConnection.disconnect();
    });
  }
}
