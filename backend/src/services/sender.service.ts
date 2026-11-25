import { SenderAccount } from '@prisma/client';
import { prisma } from '../config/db';
import { ENV } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { normalizeEmail } from '../utils/sanitize';
import { getSenderHourlyUsage } from './rateLimiter.service';

export interface SenderWithUsage extends SenderAccount {
  usage: {
    sentThisHour: number;
    hourlyLimit: number;
    remaining: number;
    resetAt: string;
  };
}

export async function ensureDefaultSender(
  userId: string,
  fallbackEmail: string,
  fallbackName?: string | null
): Promise<SenderAccount> {
  const existingDefault = await prisma.senderAccount.findFirst({
    where: { userId, isDefault: true },
  });
  if (existingDefault) return existingDefault;

  const anyExisting = await prisma.senderAccount.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  if (anyExisting) return anyExisting;

  return prisma.senderAccount.create({
    data: {
      userId,
      email: normalizeEmail(fallbackEmail),
      name: fallbackName || 'Default Sender',
      hourlyLimit: ENV.DEFAULT_SENDER_HOURLY_LIMIT,
      minDelayMs: 0,
      isActive: true,
      isDefault: true,
    },
  });
}

export async function listSendersWithUsage(userId: string): Promise<SenderWithUsage[]> {
  const senders = await prisma.senderAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return Promise.all(
    senders.map(async (sender) => ({
      ...sender,
      usage: await getSenderHourlyUsage(sender.id, sender.hourlyLimit),
    }))
  );
}

export async function createSender(
  userId: string,
  input: {
    email: string;
    name?: string;
    hourlyLimit?: number;
    minDelayMs?: number;
    isDefault?: boolean;
  }
): Promise<SenderWithUsage> {
  const email = normalizeEmail(input.email);

  const sender = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.senderAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const existingCount = await tx.senderAccount.count({ where: { userId } });

    return tx.senderAccount.create({
      data: {
        userId,
        email,
        name: input.name?.trim() || null,
        hourlyLimit: input.hourlyLimit ?? ENV.DEFAULT_SENDER_HOURLY_LIMIT,
        minDelayMs: input.minDelayMs ?? 0,
        isActive: true,
        isDefault: input.isDefault ?? existingCount === 0,
      },
    });
  });

  return {
    ...sender,
    usage: await getSenderHourlyUsage(sender.id, sender.hourlyLimit),
  };
}

export async function updateSender(
  userId: string,
  senderId: string,
  input: {
    name?: string;
    hourlyLimit?: number;
    minDelayMs?: number;
    isActive?: boolean;
    isDefault?: boolean;
  }
): Promise<SenderWithUsage> {
  const existing = await prisma.senderAccount.findFirst({
    where: { id: senderId, userId },
  });
  if (!existing) {
    throw new AppError(404, 'Sender account not found', 'SENDER_NOT_FOUND');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.senderAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.senderAccount.update({
      where: { id: senderId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() || null } : {}),
        ...(input.hourlyLimit !== undefined ? { hourlyLimit: input.hourlyLimit } : {}),
        ...(input.minDelayMs !== undefined ? { minDelayMs: input.minDelayMs } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
  });

  return {
    ...updated,
    usage: await getSenderHourlyUsage(updated.id, updated.hourlyLimit),
  };
}

export async function deleteSender(userId: string, senderId: string): Promise<void> {
  const existing = await prisma.senderAccount.findFirst({
    where: { id: senderId, userId },
  });
  if (!existing) {
    throw new AppError(404, 'Sender account not found', 'SENDER_NOT_FOUND');
  }

  const totalCount = await prisma.senderAccount.count({ where: { userId } });
  if (totalCount <= 1) {
    throw new AppError(
      400,
      'At least one sender account is required for your workspace.',
      'CANNOT_DELETE_LAST_SENDER'
    );
  }

  await prisma.senderAccount.delete({ where: { id: senderId } });

  if (existing.isDefault) {
    const nextSender = await prisma.senderAccount.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (nextSender) {
      await prisma.senderAccount.update({
        where: { id: nextSender.id },
        data: { isDefault: true },
      });
    }
  }
}
