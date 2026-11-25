import { JobStatus, Prisma, RecurrenceType } from '@prisma/client';
import { prisma } from '../config/db';
import { ENV } from '../config/env';
import { esClient, indexEmailJob } from '../config/elasticsearch';
import { AppError } from '../middleware/error.middleware';
import {
  cancelScheduledJob,
  getQueueMetrics,
  rescheduleDelayedEmail,
  scheduleDelayedEmail,
  scheduleRecurringEmail,
} from '../queues/email.queue';
import { normalizeEmail } from '../utils/sanitize';
import { ensureDefaultSender, listSendersWithUsage } from './sender.service';

export interface ScheduleJobsInput {
  recipientEmail?: string;
  recipients?: string[];
  subject: string;
  body: string;
  scheduledFor?: string;
  delaySeconds?: number;
  staggerDelayMs?: number;
  recurrence?: RecurrenceType;
  repeatIntervalMs?: number;
  senderId?: string;
  idempotencyKey?: string;
}

function resolveRecurrenceIntervalMs(
  recurrence: RecurrenceType,
  explicitMs?: number
): number | null {
  if (recurrence === 'NONE') return null;
  if (explicitMs && explicitMs >= 1000) return explicitMs;
  switch (recurrence) {
    case 'EVERY_HOUR':
      return 60 * 60 * 1000;
    case 'DAILY':
      return 24 * 60 * 60 * 1000;
    case 'WEEKLY':
      return 7 * 24 * 60 * 60 * 1000;
    case 'MONTHLY':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

export async function scheduleEmailJobs(
  user: { id: string; email: string; name: string | null },
  input: ScheduleJobsInput
) {
  const rawRecipients = input.recipients?.length
    ? input.recipients
    : input.recipientEmail
    ? [input.recipientEmail]
    : [];

  const recipients = Array.from(new Set(rawRecipients.map(normalizeEmail).filter(Boolean)));
  if (recipients.length === 0) {
    throw new AppError(400, 'At least one recipient email is required.', 'RECIPIENT_REQUIRED');
  }

  // Idempotency check for single-recipient requests
  if (input.idempotencyKey && recipients.length === 1) {
    const existing = await prisma.emailJob.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: user.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { sender: true, logs: { orderBy: { timestamp: 'desc' }, take: 5 } },
    });
    if (existing) {
      return { deduplicated: true, jobs: [existing] };
    }
  }

  const sender = input.senderId
    ? await prisma.senderAccount.findFirst({ where: { id: input.senderId, userId: user.id } })
    : await ensureDefaultSender(user.id, user.email, user.name);

  if (!sender) {
    throw new AppError(404, 'Selected sender account not found.', 'SENDER_NOT_FOUND');
  }

  const nowMs = Date.now();
  const baseTargetMs = input.scheduledFor
    ? new Date(input.scheduledFor).getTime()
    : input.delaySeconds !== undefined
    ? nowMs + Math.max(0, input.delaySeconds) * 1000
    : nowMs;

  if (Number.isNaN(baseTargetMs)) {
    throw new AppError(400, 'Invalid scheduledFor date.', 'INVALID_DATE');
  }

  const recurrence = input.recurrence || 'NONE';
  const repeatIntervalMs = resolveRecurrenceIntervalMs(recurrence, input.repeatIntervalMs);
  const staggerMs = Math.max(0, input.staggerDelayMs ?? 0);
  const senderDisplay = sender.name ? `${sender.name} <${sender.email}>` : sender.email;

  const createdJobs = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipientEmail = recipients[i];
    const targetMs = baseTargetMs + i * staggerMs;
    const delayMs = Math.max(0, targetMs - Date.now());
    const targetDate = new Date(targetMs);
    const idempKey =
      input.idempotencyKey && recipients.length === 1
        ? input.idempotencyKey
        : input.idempotencyKey
        ? `${input.idempotencyKey}:${i}`
        : null;

    const emailJob = await prisma.emailJob.create({
      data: {
        userId: user.id,
        senderId: sender.id,
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
      },
    });

    const payload = {
      jobId: emailJob.id,
      userId: user.id,
      senderId: sender.id,
      senderEmail: senderDisplay,
      recipientEmail,
      subject: emailJob.subject,
      body: emailJob.body,
      scheduledFor: targetDate.toISOString(),
      isRecurring: recurrence !== 'NONE',
    };

    let bullJobId = emailJob.id;
    let bullRepeatJobKey: string | null = null;

    if (recurrence !== 'NONE' && repeatIntervalMs) {
      const rep = await scheduleRecurringEmail(payload, repeatIntervalMs, delayMs);
      bullJobId = rep.id || emailJob.id;
      bullRepeatJobKey = rep.repeatJobKey || null;
    } else {
      const bullJob = await scheduleDelayedEmail(payload, delayMs);
      bullJobId = bullJob.id ? String(bullJob.id) : emailJob.id;
    }

    const updated = await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId, bullRepeatJobKey },
      include: { sender: true },
    });

    await prisma.emailJobLog.create({
      data: {
        jobId: emailJob.id,
        event: 'SCHEDULED',
        message:
          recurrence !== 'NONE'
            ? `Recurring (${recurrence}) job scheduled starting ${targetDate.toISOString()}`
            : `Scheduled for ${targetDate.toISOString()} (delay ${delayMs}ms)`,
      },
    });

    void indexEmailJob({
      jobId: updated.id,
      userId: user.id,
      senderId: sender.id,
      senderEmail: senderDisplay,
      recipientEmail,
      subject: updated.subject,
      body: updated.body,
      status: updated.status,
      recurrence: updated.recurrence,
      scheduledFor: updated.scheduledFor.toISOString(),
      sentAt: null,
      createdAt: updated.createdAt.toISOString(),
    });

    createdJobs.push(updated);
  }

  return { deduplicated: false, jobs: createdJobs };
}

export async function listEmailJobs(
  userId: string,
  options: {
    status?: JobStatus;
    senderId?: string;
    page: number;
    limit: number;
  }
) {
  const where: Prisma.EmailJobWhereInput = {
    userId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.senderId ? { senderId: options.senderId } : {}),
  };

  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    prisma.emailJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: options.limit,
      include: {
        sender: { select: { id: true, email: true, name: true, hourlyLimit: true } },
        logs: { orderBy: { timestamp: 'desc' }, take: 3 },
      },
    }),
    prisma.emailJob.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    },
  };
}

export async function getEmailJobById(userId: string, jobId: string) {
  const job = await prisma.emailJob.findFirst({
    where: { id: jobId, userId },
    include: {
      sender: { select: { id: true, email: true, name: true, hourlyLimit: true, isActive: true } },
      logs: { orderBy: { timestamp: 'asc' } },
    },
  });

  if (!job) {
    throw new AppError(404, 'Email job not found.', 'JOB_NOT_FOUND');
  }

  return job;
}

export async function rescheduleEmailJob(
  userId: string,
  jobId: string,
  input: { scheduledFor?: string; delaySeconds?: number }
) {
  const existing = await prisma.emailJob.findFirst({
    where: { id: jobId, userId },
    include: { sender: true },
  });

  if (!existing) {
    throw new AppError(404, 'Email job not found.', 'JOB_NOT_FOUND');
  }

  if (existing.status === 'COMPLETED' || existing.status === 'PROCESSING') {
    throw new AppError(
      400,
      `Cannot reschedule a job that is already ${existing.status}.`,
      'INVALID_JOB_STATE'
    );
  }

  const nowMs = Date.now();
  const targetMs = input.scheduledFor
    ? new Date(input.scheduledFor).getTime()
    : input.delaySeconds !== undefined
    ? nowMs + Math.max(0, input.delaySeconds) * 1000
    : nowMs;

  if (Number.isNaN(targetMs)) {
    throw new AppError(400, 'Invalid scheduledFor date.', 'INVALID_DATE');
  }

  const targetDate = new Date(targetMs);
  const delayMs = Math.max(0, targetMs - Date.now());

  const bullJob = await rescheduleDelayedEmail(
    {
      jobId: existing.id,
      userId,
      senderId: existing.senderId,
      senderEmail: existing.senderEmail,
      recipientEmail: existing.recipientEmail,
      subject: existing.subject,
      body: existing.body,
      scheduledFor: targetDate.toISOString(),
      isRecurring: false,
    },
    delayMs,
    existing.bullRepeatJobKey
  );

  const updated = await prisma.emailJob.update({
    where: { id: existing.id },
    data: {
      status: 'SCHEDULED',
      scheduledFor: targetDate,
      delayMs,
      recurrence: 'NONE',
      repeatIntervalMs: null,
      bullRepeatJobKey: null,
      bullJobId: bullJob.id ? String(bullJob.id) : existing.id,
      failedAt: null,
      failureReason: null,
    },
    include: { sender: true },
  });

  await prisma.emailJobLog.create({
    data: {
      jobId: existing.id,
      event: 'RESCHEDULED',
      message: `Rescheduled for ${targetDate.toISOString()} (delay ${delayMs}ms)`,
    },
  });

  void indexEmailJob({
    jobId: updated.id,
    userId,
    senderId: updated.senderId,
    senderEmail: updated.senderEmail,
    recipientEmail: updated.recipientEmail,
    subject: updated.subject,
    body: updated.body,
    status: updated.status,
    recurrence: updated.recurrence,
    scheduledFor: updated.scheduledFor.toISOString(),
    sentAt: updated.sentAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });

  return updated;
}

export async function cancelEmailJob(userId: string, jobId: string) {
  const existing = await prisma.emailJob.findFirst({
    where: { id: jobId, userId },
  });

  if (!existing) {
    throw new AppError(404, 'Email job not found.', 'JOB_NOT_FOUND');
  }

  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    throw new AppError(
      400,
      `Job is already ${existing.status}.`,
      'INVALID_JOB_STATE'
    );
  }

  await cancelScheduledJob(existing.bullJobId || existing.id, existing.bullRepeatJobKey);

  const updated = await prisma.emailJob.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
  });

  await prisma.emailJobLog.create({
    data: {
      jobId: existing.id,
      event: 'CANCELLED',
      message: 'Job cancelled by user.',
    },
  });

  void indexEmailJob({
    jobId: updated.id,
    userId,
    senderId: updated.senderId,
    senderEmail: updated.senderEmail,
    recipientEmail: updated.recipientEmail,
    subject: updated.subject,
    body: updated.body,
    status: updated.status,
    recurrence: updated.recurrence,
    scheduledFor: updated.scheduledFor.toISOString(),
    sentAt: updated.sentAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });

  return updated;
}

export async function searchEmailJobs(
  userId: string,
  options: { q: string; status?: JobStatus; page: number; limit: number }
) {
  const from = (options.page - 1) * options.limit;

  try {
    const filters: Record<string, unknown>[] = [{ term: { userId } }];
    if (options.status) {
      filters.push({ term: { status: options.status } });
    }

    const response = await esClient.search({
      index: ENV.ELASTICSEARCH_INDEX,
      from,
      size: options.limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: options.q,
                fields: ['subject^2', 'body', 'recipientEmail^1.5', 'senderEmail'],
                fuzziness: 'AUTO',
              },
            },
          ],
          filter: filters,
        },
      },
      sort: [{ createdAt: { order: 'desc', unmapped_type: 'date' } }],
    });

    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value ?? response.hits.hits.length;

    const hits = response.hits.hits
      .map((h) => h._source as Record<string, unknown> | undefined)
      .filter((s): s is Record<string, unknown> => Boolean(s))
      .map((s) => ({
        ...s,
        id: (s.jobId as string) || (s.id as string),
      }));

    return {
      searchEngine: 'elasticsearch' as const,
      items: hits,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / options.limit)),
      },
    };
  } catch {
    // Graceful PostgreSQL fallback if Elasticsearch is temporarily unavailable
    const where: Prisma.EmailJobWhereInput = {
      userId,
      ...(options.status ? { status: options.status } : {}),
      OR: [
        { subject: { contains: options.q, mode: 'insensitive' } },
        { body: { contains: options.q, mode: 'insensitive' } },
        { recipientEmail: { contains: options.q, mode: 'insensitive' } },
        { senderEmail: { contains: options.q, mode: 'insensitive' } },
      ],
    };

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: from,
        take: options.limit,
        include: {
          sender: { select: { id: true, email: true, name: true, hourlyLimit: true } },
        },
      }),
      prisma.emailJob.count({ where }),
    ]);

    return {
      searchEngine: 'postgres-fallback' as const,
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / options.limit)),
      },
    };
  }
}

export async function getDashboardStats(userId: string) {
  const [grouped, senders, queueMetrics, upcomingJobs, recentJobs] = await Promise.all([
    prisma.emailJob.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    }),
    listSendersWithUsage(userId),
    getQueueMetrics(),
    prisma.emailJob.findMany({
      where: { userId, status: { in: ['SCHEDULED', 'PENDING'] } },
      orderBy: { scheduledFor: 'asc' },
      take: 5,
      select: {
        id: true,
        recipientEmail: true,
        senderEmail: true,
        subject: true,
        status: true,
        scheduledFor: true,
        recurrence: true,
      },
    }),
    prisma.emailJob.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        recipientEmail: true,
        senderEmail: true,
        subject: true,
        status: true,
        scheduledFor: true,
        sentAt: true,
        failedAt: true,
        failureReason: true,
        previewUrl: true,
        updatedAt: true,
      },
    }),
  ]);

  const counts: Record<JobStatus, number> = {
    SCHEDULED: 0,
    PENDING: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };

  let total = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    total += row._count._all;
  }

  return {
    summary: {
      total,
      scheduled: counts.SCHEDULED,
      pending: counts.PENDING + counts.PROCESSING,
      processing: counts.PROCESSING,
      completed: counts.COMPLETED,
      failed: counts.FAILED,
      cancelled: counts.CANCELLED,
      activeSenders: senders.filter((s) => s.isActive).length,
      totalSenders: senders.length,
    },
    queue: queueMetrics,
    senders,
    upcomingJobs,
    recentJobs,
  };
}
