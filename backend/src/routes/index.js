const { Router } = require('express');
const mongoose = require('mongoose');
const { redisConnection } = require('../config/redis');
const { jobRouter } = require('./job.routes');
const { authRouter } = require('./auth.routes');
const { senderRouter } = require('./sender.routes');
const { dashboardRouter } = require('./dashboard.routes');

const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    dbOk = mongoose.connection.readyState === 1;
  } catch { dbOk = false; }

  let redisOk = false;
  try {
    redisOk = (await redisConnection.ping()) === 'PONG';
  } catch { redisOk = false; }

  const status = dbOk && redisOk ? 'healthy' : 'degraded';
  res.status(dbOk && redisOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    service: 'reachinbox-scheduler-api',
    dependencies: {
      mongodb: dbOk    ? 'connected' : 'unavailable',
      redis:   redisOk ? 'connected' : 'unavailable',
    },
  });
});

apiRouter.use('/auth',      authRouter);
apiRouter.use('/jobs',      jobRouter);
apiRouter.use('/senders',   senderRouter);
apiRouter.use('/dashboard', dashboardRouter);

module.exports = { apiRouter };
