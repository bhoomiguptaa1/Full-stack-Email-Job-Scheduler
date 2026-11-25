import { createEmailWorker } from './workers/email.worker';
import { connectDB, disconnectDB } from './config/db';
import { disconnectRedis } from './config/redis';
import { initElasticsearch } from './config/elasticsearch';
import { logger } from './utils/logger';

async function runWorker() {
  logger.info('[Worker Process] Initializing standalone BullMQ email worker...');
  await connectDB();
  await initElasticsearch();

  const worker = createEmailWorker();
  logger.info('[Worker Process] BullMQ email worker is listening for jobs.');

  const shutdown = async (signal: string) => {
    logger.info(`[Worker Process] Received ${signal}. Shutting down worker...`);
    await worker.close();
    await disconnectRedis();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

runWorker().catch((err) => {
  logger.error('[Worker Process] Fatal error in worker', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
