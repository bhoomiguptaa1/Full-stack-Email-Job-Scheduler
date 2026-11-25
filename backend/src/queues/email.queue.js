const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');
const { QUEUE_NAMES } = require('../constants');

const emailQueue = new Queue(QUEUE_NAMES.EMAIL_DISPATCH, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

async function scheduleDelayedEmail(payload, delayMs) {
  return emailQueue.add('send-scheduled-email', payload, {
    jobId: payload.jobId,
    delay: Math.max(0, delayMs),
  });
}

async function scheduleRecurringEmail(payload, repeatEveryMs, initialDelayMs = 0) {
  const job = await emailQueue.add('send-recurring-email', payload, {
    jobId: `repeat:${payload.jobId}`,
    delay: Math.max(0, initialDelayMs),
    repeat: { every: Math.max(1000, repeatEveryMs) },
  });
  return { id: job.id ? String(job.id) : undefined, repeatJobKey: job.repeatJobKey };
}

async function cancelScheduledJob(jobId, bullRepeatJobKey) {
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

async function rescheduleDelayedEmail(payload, delayMs, bullRepeatJobKey) {
  await cancelScheduledJob(payload.jobId, bullRepeatJobKey);
  return scheduleDelayedEmail(payload, delayMs);
}

async function getQueueMetrics() {
  try {
    const counts = await emailQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused');
    const isPaused = await emailQueue.isPaused();
    return {
      connected: true,
      isPaused,
      waiting:   counts.waiting   || 0,
      active:    counts.active    || 0,
      delayed:   counts.delayed   || 0,
      completed: counts.completed || 0,
      failed:    counts.failed    || 0,
      paused:    counts.paused    || 0,
    };
  } catch {
    return { connected: false, isPaused: false, waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, paused: 0 };
  }
}

module.exports = {
  emailQueue,
  scheduleDelayedEmail,
  scheduleRecurringEmail,
  cancelScheduledJob,
  rescheduleDelayedEmail,
  getQueueMetrics,
};
