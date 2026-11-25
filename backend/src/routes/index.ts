import { Router } from 'express';
import { prisma } from '../config/db';
import { redisConnection } from '../config/redis';
import { isElasticsearchAvailable } from '../config/elasticsearch';
import { jobRouter } from './job.routes';
import { authRouter } from './auth.routes';
import { senderRouter } from './sender.routes';
import { dashboardRouter } from './dashboard.routes';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  let redisOk = false;
  try {
    redisOk = (await redisConnection.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }

  const esOk = isElasticsearchAvailable();
  const status = dbOk && redisOk ? 'healthy' : 'degraded';

  res.status(dbOk && redisOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    service: 'reachinbox-scheduler-api',
    dependencies: {
      postgres: dbOk ? 'connected' : 'unavailable',
      redis: redisOk ? 'connected' : 'unavailable',
      elasticsearch: esOk ? 'connected' : 'fallback',
    },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/jobs', jobRouter);
apiRouter.use('/senders', senderRouter);
apiRouter.use('/dashboard', dashboardRouter);
