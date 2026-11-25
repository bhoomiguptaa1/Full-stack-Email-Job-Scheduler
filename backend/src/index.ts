import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Worker } from 'bullmq';
import { ENV } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { disconnectRedis } from './config/redis';
import { initElasticsearch } from './config/elasticsearch';
import { setupBullBoard } from './queues/board';
import { emailQueue } from './queues/email.queue';
import { apiRouter } from './routes';
import { createEmailWorker } from './workers/email.worker';
import { createHttpRateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

const app = express();

// Strict security headers on API, relaxed CSP only for Bull-Board UI
app.use('/api', helmet());
app.use('/admin/queues', helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = new Set([
        ENV.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
      ]);
      // Allow any *.vercel.app subdomain in production
      if (!origin || allowed.has(origin) || /^https:\/\/[^.]+\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));

// BullMQ Monitoring Dashboard (Bull-Board)
const bullBoardAdapter = setupBullBoard();
app.use('/admin/queues', bullBoardAdapter.getRouter());

// API rate limiting + REST API routes
const apiLimiter = createHttpRateLimiter({
  keyPrefix: 'api',
  windowSeconds: 60,
  maxRequests: ENV.API_RATE_LIMIT_MAX,
});
app.use('/api', apiLimiter, apiRouter);

// Centralized 404 & Error handling
app.use(notFoundHandler);
app.use(errorHandler);

let worker: Worker | null = null;
let server: ReturnType<typeof app.listen> | null = null;

async function shutdown(signal: string) {
  logger.info(`[Server] Received ${signal}. Shutting down gracefully...`);
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  if (worker) {
    await worker.close().catch(() => {});
  }
  await emailQueue.close().catch(() => {});
  await disconnectRedis().catch(() => {});
  await disconnectDB().catch(() => {});
  process.exit(0);
}

async function startServer() {
  await connectDB();
  await initElasticsearch();

  if (process.env.RUN_IN_PROCESS_WORKER !== 'false') {
    worker = createEmailWorker();
    logger.info('[BullMQ] Worker started in-process.', { concurrency: ENV.WORKER_CONCURRENCY });
  }

  server = app.listen(ENV.PORT, () => {
    logger.info(`ReachInbox API Server running on port ${ENV.PORT}`);
    logger.info(`Bull-Board Dashboard: http://localhost:${ENV.PORT}/admin/queues`);
    logger.info(`Health check: http://localhost:${ENV.PORT}/api/health`);
  });

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Fatal error starting server', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}

export { app };
