const { createEmailWorker } = require('./workers/email.worker');
const { connectDB, disconnectDB } = require('./config/db');
const { disconnectRedis } = require('./config/redis');
const { logger } = require('./utils/logger');

async function runWorker() {
  logger.info('[Worker Process] Initializing standalone BullMQ email worker...');
  await connectDB();

  const worker = createEmailWorker();
  logger.info('[Worker Process] BullMQ email worker is listening for jobs.');

  const shutdown = async (signal) => {
    logger.info(`[Worker Process] Received ${signal}. Shutting down worker...`);
    await worker.close();
    await disconnectRedis();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

runWorker().catch((err) => {
  require('./utils/logger').logger.error('[Worker Process] Fatal error in worker', { error: err.message });
  process.exit(1);
});
