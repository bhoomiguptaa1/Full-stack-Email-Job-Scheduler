import { Worker, Job, DelayedError } from 'bullmq';
import { redisConnection } from '../config/redis';
import { QUEUE_NAMES } from '../constants';
import { ENV } from '../config/env';
import { EmailJobPayload } from '../queues/email.queue';
import { sendEmail } from '../services/email.service';
import { prisma } from '../config/db';
import { indexEmailJob } from '../config/elasticsearch';
import { acquireIdempotencyLock, consumeSenderHourlyQuota } from '../services/rateLimiter.service';
import { notifySlackJobEvent } from '../services/slack.service';
import { logger } from '../utils/logger';

async function safeLogJobEvent(
  jobId: string,
  event: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.emailJobLog.create({
      data: {
        jobId,
        event,
        message,
        metadata: metadata as any,
      },
    });
  } catch {
    // Do not fail worker delivery on audit log write failure
  }
}

export function createEmailWorker() {
  const worker = new Worker<EmailJobPayload>(
    QUEUE_NAMES.EMAIL_DISPATCH,
    async (job: Job<EmailJobPayload>, token?: string) => {
      const { jobId, userId, senderId, senderEmail, recipientEmail, subject, body, isRecurring } =
        job.data;

      // 1. Verify DB state before processing (prevents duplicate delivery or sending cancelled jobs)
      const dbJob = await prisma.emailJob.findUnique({
        where: { id: jobId },
        include: { sender: true },
      });

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

      // 2. Distributed Redis idempotency lock per execution window
      const lockScope = isRecurring ? `${jobId}:${Math.floor(job.timestamp / 1000)}` : jobId;
      const lockAcquired = await acquireIdempotencyLock(lockScope, 3600);
      if (!lockAcquired) {
        logger.info('[BullMQ Worker] Idempotency lock skipped duplicate execution', { jobId });
        return { skipped: true, reason: 'duplicate_lock' };
      }

      // 3. Sender status & persistent hourly rate-limit enforcement
      const effectiveSenderId = dbJob.senderId || senderId || `user:${userId}`;
      const hourlyLimit = dbJob.sender?.hourlyLimit ?? ENV.DEFAULT_SENDER_HOURLY_LIMIT;

      if (dbJob.sender && !dbJob.sender.isActive) {
        const deferUntil = Date.now() + 60_000;
        await safeLogJobEvent(
          jobId,
          'SENDER_PAUSED',
          'Sender account is paused; deferred delivery by 60s.'
        );
        await job.moveToDelayed(deferUntil, token);
        throw new DelayedError();
      }

      const quota = await consumeSenderHourlyQuota(effectiveSenderId, hourlyLimit);
      if (!quota.allowed) {
        await prisma.emailJob
          .update({
            where: { id: jobId },
            data: {
              status: 'SCHEDULED',
              rateLimitedCount: { increment: 1 },
              scheduledFor: new Date(quota.resetAtMs),
            },
          })
          .catch(() => {});

        await safeLogJobEvent(
          jobId,
          'RATE_LIMITED',
          `Sender hourly limit (${quota.limit}/hr) reached. Deferred until ${new Date(
            quota.resetAtMs
          ).toISOString()}.`,
          { limit: quota.limit, resetAt: new Date(quota.resetAtMs).toISOString() }
        );

        void notifySlackJobEvent(userId, {
          event: 'RATE_LIMITED',
          jobId,
          recipientEmail,
          subject,
          details: `Hourly limit (${quota.limit}/hr) reached. Deferred to next hour window.`,
        });

        await job.moveToDelayed(quota.resetAtMs, token);
        throw new DelayedError();
      }

      // 4. Optional per-sender minimum delay pacing
      if (dbJob.sender?.minDelayMs && dbJob.sender.minDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(dbJob.sender!.minDelayMs, 5000)));
      }

      // 5. Mark PROCESSING
      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });
      await safeLogJobEvent(
        jobId,
        'PROCESSING',
        `Worker picked up job (Attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 3})`
      );

      // 6. Deliver email via Nodemailer / Ethereal
      const fromAddress = dbJob.sender
        ? dbJob.sender.name
          ? `${dbJob.sender.name} <${dbJob.sender.email}>`
          : dbJob.sender.email
        : senderEmail || ENV.EMAIL_FROM;

      const mailResult = await sendEmail({
        from: fromAddress,
        to: recipientEmail,
        subject,
        html: body,
      });

      const sentAt = new Date();
      const previewUrl = mailResult.previewUrl ? String(mailResult.previewUrl) : null;

      logger.info('[BullMQ Worker] Email delivered', {
        jobId,
        recipientEmail,
        messageId: mailResult.messageId,
      });

      // 7. Mark COMPLETED in PostgreSQL
      await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          sentAt,
          failedAt: null,
          failureReason: null,
          previewUrl,
        },
      });

      await safeLogJobEvent(
        jobId,
        'COMPLETED',
        `Delivered successfully.${previewUrl ? ` Preview: ${previewUrl}` : ''}`,
        { messageId: mailResult.messageId, previewUrl }
      );

      // 8. Sync Elasticsearch index
      await indexEmailJob({
        jobId,
        userId,
        senderId: dbJob.senderId,
        senderEmail: dbJob.senderEmail || fromAddress,
        recipientEmail,
        subject,
        body,
        status: 'COMPLETED',
        recurrence: dbJob.recurrence,
        scheduledFor: dbJob.scheduledFor.toISOString(),
        sentAt: sentAt.toISOString(),
        previewUrl,
        createdAt: dbJob.createdAt.toISOString(),
      });

      // 9. Async Slack completion notification
      void notifySlackJobEvent(userId, {
        event: 'COMPLETED',
        jobId,
        recipientEmail,
        subject,
        previewUrl,
      });

      return { success: true, previewUrl };
    },
    {
      connection: redisConnection,
      concurrency: ENV.WORKER_CONCURRENCY,
    }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    // DelayedError is used for intentional rate-limit deferrals, not failures
    if (err instanceof DelayedError || err.name === 'DelayedError') return;

    const maxAttempts = job.opts.attempts ?? 3;
    const isFinalFailure = job.attemptsMade >= maxAttempts;
    const { jobId, userId, recipientEmail, subject, body } = job.data;

    logger.error('[BullMQ Worker] Job attempt failed', {
      jobId,
      attempt: job.attemptsMade,
      maxAttempts,
      error: err.message,
    });

    try {
      const updated = await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: isFinalFailure ? 'FAILED' : 'PENDING',
          retryCount: job.attemptsMade,
          ...(isFinalFailure ? { failedAt: new Date(), failureReason: err.message } : {}),
        },
      });

      await safeLogJobEvent(
        jobId,
        isFinalFailure ? 'FAILED' : 'RETRY_SCHEDULED',
        isFinalFailure
          ? `Exhausted ${maxAttempts} attempts: ${err.message}`
          : `Attempt ${job.attemptsMade} failed (${err.message}); retry scheduled.`
      );

      await indexEmailJob({
        jobId,
        userId,
        senderId: updated.senderId,
        senderEmail: updated.senderEmail,
        recipientEmail,
        subject,
        body,
        status: updated.status,
        recurrence: updated.recurrence,
        scheduledFor: updated.scheduledFor.toISOString(),
        sentAt: updated.sentAt?.toISOString() ?? null,
        failureReason: updated.failureReason,
        createdAt: updated.createdAt.toISOString(),
      });

      if (isFinalFailure) {
        void notifySlackJobEvent(userId, {
          event: 'FAILED',
          jobId,
          recipientEmail,
          subject,
          details: err.message,
        });
      }
    } catch {
      // Ignore fallback DB errors
    }
  });

  worker.on('stalled', (jobId) => {
    logger.warn('[BullMQ Worker] Job stalled and will be re-evaluated', { jobId });
  });

  worker.on('error', (err) => {
    logger.error('[BullMQ Worker] Worker error', { error: err.message });
    void notifySlackJobEvent(undefined, {
      event: 'QUEUE_ERROR',
      jobId: 'worker-system',
      recipientEmail: 'system',
      subject: 'BullMQ Worker Error',
      details: err.message,
    });
  });

  return worker;
}
