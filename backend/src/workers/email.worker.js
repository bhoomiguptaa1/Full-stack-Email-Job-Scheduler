const { Worker, DelayedError } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { QUEUE_NAMES } = require('../constants');
const { ENV } = require('../config/env');
const { sendEmail } = require('../services/email.service');
const EmailJob    = require('../models/EmailJob');
const EmailJobLog = require('../models/EmailJobLog');
const { acquireIdempotencyLock, consumeSenderHourlyQuota } = require('../services/rateLimiter.service');
const { logger } = require('../utils/logger');

async function safeLogJobEvent(jobId, event, message, metadata) {
  try {
    await EmailJobLog.create({ jobId, event, message, metadata: metadata || null });
  } catch { /* do not fail delivery on log write failure */ }
}

function createEmailWorker() {
  const worker = new Worker(
    QUEUE_NAMES.EMAIL_DISPATCH,
    async (job, token) => {
      const { jobId, userId, senderId, senderEmail, recipientEmail, subject, body, isRecurring } = job.data;

      // 1. Verify DB state before processing
      const dbJob = await EmailJob.findById(jobId).populate('senderId');
      if (!dbJob) {
        logger.warn('[BullMQ Worker] Skipping job missing from DB', { jobId });
        return { skipped: true, reason: 'missing' };
      }
      if (dbJob.status === 'CANCELLED') {
        logger.info('[BullMQ Worker] Skipping cancelled job', { jobId });
        return { skipped: true, reason: 'cancelled' };
      }
      if (!isRecurring && dbJob.status === 'COMPLETED' && dbJob.sentAt) {
        logger.info('[BullMQ Worker] Idempotency guard skipped already-completed job', { jobId });
        return { skipped: true, reason: 'already_completed' };
      }

      // 2. Distributed Redis idempotency lock
      const lockScope = isRecurring ? `${jobId}:${Math.floor(job.timestamp / 1000)}` : jobId;
      const lockAcquired = await acquireIdempotencyLock(lockScope, 3600);
      if (!lockAcquired) {
        logger.info('[BullMQ Worker] Idempotency lock skipped duplicate execution', { jobId });
        return { skipped: true, reason: 'duplicate_lock' };
      }

      // 3. Sender status & hourly rate-limit enforcement
      const effectiveSenderId = dbJob.senderId ? String(dbJob.senderId._id) : (senderId || `user:${userId}`);
      const hourlyLimit = dbJob.senderId?.hourlyLimit ?? ENV.DEFAULT_SENDER_HOURLY_LIMIT;

      if (dbJob.senderId && !dbJob.senderId.isActive) {
        const deferUntil = Date.now() + 60_000;
        await safeLogJobEvent(jobId, 'SENDER_PAUSED', 'Sender account is paused; deferred delivery by 60s.');
        await job.moveToDelayed(deferUntil, token);
        throw new DelayedError();
      }

      const quota = await consumeSenderHourlyQuota(effectiveSenderId, hourlyLimit);
      if (!quota.allowed) {
        await EmailJob.findByIdAndUpdate(jobId, {
          status: 'SCHEDULED',
          $inc: { rateLimitedCount: 1 },
          scheduledFor: new Date(quota.resetAtMs),
        }).catch(() => {});

        await safeLogJobEvent(
          jobId, 'RATE_LIMITED',
          `Sender hourly limit (${quota.limit}/hr) reached. Deferred until ${new Date(quota.resetAtMs).toISOString()}.`,
          { limit: quota.limit, resetAt: new Date(quota.resetAtMs).toISOString() }
        );

        await job.moveToDelayed(quota.resetAtMs, token);
        throw new DelayedError();
      }

      // 4. Optional per-sender minimum delay pacing
      if (dbJob.senderId?.minDelayMs && dbJob.senderId.minDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(dbJob.senderId.minDelayMs, 5000)));
      }

      // 5. Mark PROCESSING
      await EmailJob.findByIdAndUpdate(jobId, { status: 'PROCESSING' });
      await safeLogJobEvent(jobId, 'PROCESSING', `Worker picked up job (Attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 3})`);

      // 6. Deliver email via Nodemailer / Ethereal
      const fromAddress = dbJob.senderId
        ? dbJob.senderId.name ? `${dbJob.senderId.name} <${dbJob.senderId.email}>` : dbJob.senderId.email
        : senderEmail || ENV.EMAIL_FROM;

      const mailResult = await sendEmail({ from: fromAddress, to: recipientEmail, subject, html: body });

      const sentAt     = new Date();
      const previewUrl = mailResult.previewUrl ? String(mailResult.previewUrl) : null;

      logger.info('[BullMQ Worker] Email delivered', { jobId, recipientEmail, messageId: mailResult.messageId });

      // 7. Mark COMPLETED in MongoDB
      await EmailJob.findByIdAndUpdate(jobId, {
        status: 'COMPLETED', sentAt, failedAt: null, failureReason: null, previewUrl,
      });

      await safeLogJobEvent(
        jobId, 'COMPLETED',
        `Delivered successfully.${previewUrl ? ` Preview: ${previewUrl}` : ''}`,
        { messageId: mailResult.messageId, previewUrl }
      );

      return { success: true, previewUrl };
    },
    { connection: redisConnection, concurrency: ENV.WORKER_CONCURRENCY }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    if (err instanceof DelayedError || err.name === 'DelayedError') return;

    const maxAttempts = job.opts.attempts ?? 3;
    const isFinalFailure = job.attemptsMade >= maxAttempts;
    const { jobId } = job.data;

    logger.error('[BullMQ Worker] Job attempt failed', {
      jobId, attempt: job.attemptsMade, maxAttempts, error: err.message,
    });

    try {
      await EmailJob.findByIdAndUpdate(jobId, {
        status: isFinalFailure ? 'FAILED' : 'PENDING',
        retryCount: job.attemptsMade,
        ...(isFinalFailure ? { failedAt: new Date(), failureReason: err.message } : {}),
      });

      await safeLogJobEvent(
        jobId,
        isFinalFailure ? 'FAILED' : 'RETRY_SCHEDULED',
        isFinalFailure
          ? `Exhausted ${maxAttempts} attempts: ${err.message}`
          : `Attempt ${job.attemptsMade} failed (${err.message}); retry scheduled.`
      );
    } catch { /* ignore fallback DB errors */ }
  });

  worker.on('stalled', (jobId) => {
    logger.warn('[BullMQ Worker] Job stalled and will be re-evaluated', { jobId });
  });

  worker.on('error', (err) => {
    logger.error('[BullMQ Worker] Worker error', { error: err.message });
  });

  return worker;
}

module.exports = { createEmailWorker };
