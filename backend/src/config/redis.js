const Redis = require('ioredis');
const { ENV } = require('./env');
const { logger } = require('../utils/logger');

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 300, 3000);
  },
};

const redisConnection = ENV.REDIS_URL
  ? new Redis(ENV.REDIS_URL, redisOptions)
  : new Redis({
      host: ENV.REDIS_HOST,
      port: ENV.REDIS_PORT,
      password: ENV.REDIS_PASSWORD || undefined,
      ...redisOptions,
    });

redisConnection.on('connect', () => {
  logger.info('[Redis] Connected successfully.');
});

redisConnection.on('error', (err) => {
  logger.warn('[Redis] Connection warning', { error: err.message });
});

async function disconnectRedis() {
  if (redisConnection.status !== 'end') {
    await redisConnection.quit().catch(() => {
      redisConnection.disconnect();
    });
  }
}

module.exports = { redisConnection, disconnectRedis };
