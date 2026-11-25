import { Queue, JobsOptions } from 'bullmq';
import { redisConnection } from '../config/redis';
import { QUEUE_NAMES } from '../constants';

export interface EmailJobPayload {
  jobId: string;
  userId: string;
  senderId?: string | null;
  senderEmail?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledFor: string;
  isRecurring?: boolean;
}

export const emailQueue = new Queue<EmailJobPayload>(QUEUE_NAMES.EMAIL_DISPATCH, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

export async function scheduleDelayedEmail(
  payload: EmailJobPayload,
  delayMs: number
) {
  const options: JobsOptions = {
    jobId: payload.jobId,
    delay: Math.max(0, delayMs),
  };

  return emailQueue.add('send-scheduled-email', payload, options);
}

export async function scheduleRecurringEmail(
  payload: EmailJobPayload,
  repeatEveryMs: number,
  initialDelayMs = 0
): Promise<{ id?: string; repeatJobKey?: string }> {
  const options: JobsOptions = {
    jobId: `repeat:${payload.jobId}`,
    delay: Math.max(0, initialDelayMs),
    repeat: {
      every: Math.max(1000, repeatEveryMs),
    },
  };

  const job = await emailQueue.add('send-recurring-email', payload, options);
  return {
    id: job.id ? String(job.id) : undefined,
    repeatJobKey: job.repeatJobKey,
  };
}

export async function cancelScheduledJob(
  jobId: string,
  bullRepeatJobKey?: string | null
): Promise<boolean> {
  let removed = false;

  if (bullRepeatJobKey) {
    const repRemoved = await emailQueue.removeRepeatableByKey(bullRepeatJobKey).catch(() => false);
    if (repRemoved) removed = true;
  }

  const job = await emailQueue.getJob(jobId);
  if (job) {
    await job.remove().catch(() => {});
    removed = true;
  }

  return removed;
}

export async function rescheduleDelayedEmail(
  payload: EmailJobPayload,
  delayMs: number,
  bullRepeatJobKey?: string | null
) {
  await cancelScheduledJob(payload.jobId, bullRepeatJobKey);
  return scheduleDelayedEmail(payload, delayMs);
}

export async function getQueueMetrics() {
  try {
    const counts = await emailQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed',
      'paused'
    );
    const isPaused = await emailQueue.isPaused();
    return {
      connected: true,
      isPaused,
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      delayed: counts.delayed || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      paused: counts.paused || 0,
    };
  } catch {
    return {
      connected: false,
      isPaused: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      paused: 0,
    };
  }
}
