const EmailJob    = require('../models/EmailJob');
const EmailJobLog = require('../models/EmailJobLog');
const SenderAccount = require('../models/SenderAccount');
const { AppError } = require('../middleware/error.middleware');
const { ENV } = require('../config/env');
const {
  cancelScheduledJob,
  getQueueMetrics,
  rescheduleDelayedEmail,
  scheduleDelayedEmail,
  scheduleRecurringEmail,
} = require('../queues/email.queue');
const { normalizeEmail } = require('../utils/sanitize');
const { ensureDefaultSender, listSendersWithUsage } = require('./sender.service');

function resolveRecurrenceIntervalMs(recurrence, explicitMs) {
  if (recurrence === 'NONE') return null;
  if (explicitMs && explicitMs >= 1000) return explicitMs;
  switch (recurrence) {
    case 'EVERY_HOUR': return 60 * 60 * 1000;
    case 'DAILY':      return 24 * 60 * 60 * 1000;
    case 'WEEKLY':     return 7 * 24 * 60 * 60 * 1000;
    case 'MONTHLY':    return 30 * 24 * 60 * 60 * 1000;
    default:           return 60 * 1000;
  }
}

async function scheduleEmailJobs(user, input) {
  const rawRecipients = input.recipients?.length
    ? input.recipients
    : input.recipientEmail
    ? [input.recipientEmail]
    : [];

  const recipients = [...new Set(rawRecipients.map(normalizeEmail).filter(Boolean))];
  if (recipients.length === 0) throw new AppError(400, 'At least one recipient email is required.', 'RECIPIENT_REQUIRED');

  // Idempotency check for single-recipient requests
  if (input.idempotencyKey && recipients.length === 1) {
    const existing = await EmailJob.findOne({ userId: user.id, idempotencyKey: input.idempotencyKey })
      .populate('senderId')
      .lean();
    if (existing) {
      const logs = await EmailJobLog.find({ jobId: existing._id }).sort({ timestamp: -1 }).limit(5).lean();
      return { deduplicated: true, jobs: [{ ...existing, id: String(existing._id), logs }] };
    }
  }

  const userId = user.id;
  const sender = input.senderId
    ? await SenderAccount.findOne({ _id: input.senderId, userId })
    : await ensureDefaultSender(userId, user.email, user.name);

  if (!sender) throw new AppError(404, 'Selected sender account not found.', 'SENDER_NOT_FOUND');

  const nowMs = Date.now();
  const baseTargetMs = input.scheduledFor
    ? new Date(input.scheduledFor).getTime()
    : input.delaySeconds !== undefined
    ? nowMs + Math.max(0, input.delaySeconds) * 1000
    : nowMs;

  if (Number.isNaN(baseTargetMs)) throw new AppError(400, 'Invalid scheduledFor date.', 'INVALID_DATE');

  const recurrence       = input.recurrence || 'NONE';
  const repeatIntervalMs = resolveRecurrenceIntervalMs(recurrence, input.repeatIntervalMs);
  const staggerMs        = Math.max(0, input.staggerDelayMs ?? 0);
  const senderDisplay    = sender.name ? `${sender.name} <${sender.email}>` : sender.email;

  const createdJobs = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipientEmail = recipients[i];
    const targetMs  = baseTargetMs + i * staggerMs;
    const delayMs   = Math.max(0, targetMs - Date.now());
    const targetDate = new Date(targetMs);
    const idempKey = input.idempotencyKey && recipients.length === 1
      ? input.idempotencyKey
      : input.idempotencyKey
      ? `${input.idempotencyKey}:${i}`
      : null;

    const emailJob = await EmailJob.create({
      userId,
      senderId: sender._id,
      senderEmail: senderDisplay,
      recipientEmail,
      subject: input.subject.trim(),
      body: input.body,
      scheduledFor: targetDate,
      delayMs,
      recurrence,
      repeatIntervalMs,
      status: 'SCHEDULED',
      idempotencyKey: idempKey,
    });

    const payload = {
      jobId:          String(emailJob._id),
      userId,
      senderId:       String(sender._id),
      senderEmail:    senderDisplay,
      recipientEmail,
      subject:        emailJob.subject,
      body:           emailJob.body,
      scheduledFor:   targetDate.toISOString(),
      isRecurring:    recurrence !== 'NONE',
    };

    let bullJobId = String(emailJob._id);
    let bullRepeatJobKey = null;

    if (recurrence !== 'NONE' && repeatIntervalMs) {
      const rep = await scheduleRecurringEmail(payload, repeatIntervalMs, delayMs);
      bullJobId = rep.id || String(emailJob._id);
      bullRepeatJobKey = rep.repeatJobKey || null;
    } else {
      const bullJob = await scheduleDelayedEmail(payload, delayMs);
      bullJobId = bullJob.id ? String(bullJob.id) : String(emailJob._id);
    }

    await EmailJob.findByIdAndUpdate(emailJob._id, { bullJobId, bullRepeatJobKey });

    await EmailJobLog.create({
      jobId: emailJob._id,
      event: 'SCHEDULED',
      message: recurrence !== 'NONE'
        ? `Recurring (${recurrence}) job scheduled starting ${targetDate.toISOString()}`
        : `Scheduled for ${targetDate.toISOString()} (delay ${delayMs}ms)`,
    });

    const updated = await EmailJob.findById(emailJob._id).populate('senderId').lean();
    createdJobs.push({ ...updated, id: String(updated._id) });
  }

  return { deduplicated: false, jobs: createdJobs };
}

async function listEmailJobs(userId, { status, senderId, page, limit }) {
  const filter = { userId };
  if (status)   filter.status   = status;
  if (senderId) filter.senderId = senderId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    EmailJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'id email name hourlyLimit')
      .lean(),
    EmailJob.countDocuments(filter),
  ]);

  // Attach last 3 logs per job
  const withLogs = await Promise.all(
    items.map(async (job) => {
      const logs = await EmailJobLog.find({ jobId: job._id }).sort({ timestamp: -1 }).limit(3).lean();
      return { ...job, id: String(job._id), logs };
    })
  );

  return {
    items: withLogs,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function getEmailJobById(userId, jobId) {
  const job = await EmailJob.findOne({ _id: jobId, userId })
    .populate('senderId', 'id email name hourlyLimit isActive')
    .lean();

  if (!job) throw new AppError(404, 'Email job not found.', 'JOB_NOT_FOUND');

  const logs = await EmailJobLog.find({ jobId: job._id }).sort({ timestamp: 1 }).lean();
  return { ...job, id: String(job._id), logs };
}

async function rescheduleEmailJob(userId, jobId, { scheduledFor, delaySeconds }) {
  const existing = await EmailJob.findOne({ _id: jobId, userId }).populate('senderId');
  if (!existing) throw new AppError(404, 'Email job not found.', 'JOB_NOT_FOUND');

  if (existing.status === 'COMPLETED' || existing.status === 'PROCESSING') {
    throw new AppError(400, `Cannot reschedule a job that is already ${existing.status}.`, 'INVALID_JOB_STATE');
  }

  const nowMs = Date.now();
  const targetMs = scheduledFor
    ? new Date(scheduledFor).getTime()
    : delaySeconds !== undefined
    ? nowMs + Math.max(0, delaySeconds) * 1000
    : nowMs;

  if (Number.isNaN(targetMs)) throw new AppError(400, 'Invalid scheduledFor date.', 'INVALID_DATE');

  const targetDate = new Date(targetMs);
  const delayMs    = Math.max(0, targetMs - Date.now());

  const bullJob = await rescheduleDelayedEmail(
    {
      jobId:          String(existing._id),
      userId,
      senderId:       String(existing.senderId?._id || existing.senderId),
      senderEmail:    existing.senderEmail,
      recipientEmail: existing.recipientEmail,
      subject:        existing.subject,
      body:           existing.body,
      scheduledFor:   targetDate.toISOString(),
      isRecurring:    false,
    },
    delayMs,
    existing.bullRepeatJobKey
  );

  const updated = await EmailJob.findByIdAndUpdate(
    existing._id,
    {
      status:           'SCHEDULED',
      scheduledFor:     targetDate,
      delayMs,
      recurrence:       'NONE',
      repeatIntervalMs: null,
      bullRepeatJobKey: null,
      bullJobId:        bullJob.id ? String(bullJob.id) : String(existing._id),
      failedAt:         null,
      failureReason:    null,
    },
    { new: true }
  ).populate('senderId').lean();

  await EmailJobLog.create({
    jobId: existing._id,
    event: 'RESCHEDULED',
    message: `Rescheduled for ${targetDate.toISOString()} (delay ${delayMs}ms)`,
  });

  return { ...updated, id: String(updated._id) };
}

async function cancelEmailJob(userId, jobId) {
  const existing = await EmailJob.findOne({ _id: jobId, userId });
  if (!existing) throw new AppError(404, 'Email job not found.', 'JOB_NOT_FOUND');

  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    throw new AppError(400, `Job is already ${existing.status}.`, 'INVALID_JOB_STATE');
  }

  await cancelScheduledJob(existing.bullJobId || String(existing._id), existing.bullRepeatJobKey);

  const updated = await EmailJob.findByIdAndUpdate(existing._id, { status: 'CANCELLED' }, { new: true }).lean();

  await EmailJobLog.create({ jobId: existing._id, event: 'CANCELLED', message: 'Job cancelled by user.' });

  return { ...updated, id: String(updated._id) };
}

async function searchEmailJobs(userId, { q, status, page, limit }) {
  const filter = {
    userId,
    ...(status ? { status } : {}),
    $or: [
      { subject:        { $regex: q, $options: 'i' } },
      { body:           { $regex: q, $options: 'i' } },
      { recipientEmail: { $regex: q, $options: 'i' } },
      { senderEmail:    { $regex: q, $options: 'i' } },
    ],
  };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    EmailJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'id email name hourlyLimit')
      .lean(),
    EmailJob.countDocuments(filter),
  ]);

  return {
    searchEngine: 'mongodb',
    items: items.map((j) => ({ ...j, id: String(j._id) })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function getDashboardStats(userId) {
  const [grouped, senders, queueMetrics, upcomingJobs, recentJobs] = await Promise.all([
    EmailJob.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId.isValid(userId) ? new (require('mongoose').Types.ObjectId)(userId) : userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    listSendersWithUsage(userId),
    getQueueMetrics(),
    EmailJob.find({ userId, status: { $in: ['SCHEDULED', 'PENDING'] } })
      .sort({ scheduledFor: 1 })
      .limit(5)
      .select('recipientEmail senderEmail subject status scheduledFor recurrence')
      .lean(),
    EmailJob.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select('recipientEmail senderEmail subject status scheduledFor sentAt failedAt failureReason previewUrl updatedAt')
      .lean(),
  ]);

  const counts = { SCHEDULED: 0, PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0 };
  let total = 0;
  for (const row of grouped) {
    counts[row._id] = row.count;
    total += row.count;
  }

  return {
    summary: {
      total,
      scheduled:     counts.SCHEDULED,
      pending:       counts.PENDING + counts.PROCESSING,
      processing:    counts.PROCESSING,
      completed:     counts.COMPLETED,
      failed:        counts.FAILED,
      cancelled:     counts.CANCELLED,
      activeSenders: senders.filter((s) => s.isActive).length,
      totalSenders:  senders.length,
    },
    queue:        queueMetrics,
    senders,
    upcomingJobs: upcomingJobs.map((j) => ({ ...j, id: String(j._id) })),
    recentJobs:   recentJobs.map((j) => ({ ...j, id: String(j._id) })),
  };
}

module.exports = {
  scheduleEmailJobs,
  listEmailJobs,
  getEmailJobById,
  rescheduleEmailJob,
  cancelEmailJob,
  searchEmailJobs,
  getDashboardStats,
};
