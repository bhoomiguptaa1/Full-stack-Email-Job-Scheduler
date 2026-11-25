const SenderAccount = require('../models/SenderAccount');
const { ENV } = require('../config/env');
const { AppError } = require('../middleware/error.middleware');
const { normalizeEmail } = require('../utils/sanitize');
const { getSenderHourlyUsage } = require('./rateLimiter.service');

async function ensureDefaultSender(userId, fallbackEmail, fallbackName) {
  const existingDefault = await SenderAccount.findOne({ userId, isDefault: true });
  if (existingDefault) return existingDefault;

  const anyExisting = await SenderAccount.findOne({ userId }).sort({ createdAt: 1 });
  if (anyExisting) return anyExisting;

  return SenderAccount.create({
    userId,
    email: normalizeEmail(fallbackEmail),
    name: fallbackName || 'Default Sender',
    hourlyLimit: ENV.DEFAULT_SENDER_HOURLY_LIMIT,
    minDelayMs: 0,
    isActive: true,
    isDefault: true,
  });
}

async function listSendersWithUsage(userId) {
  const senders = await SenderAccount.find({ userId }).sort({ isDefault: -1, createdAt: 1 });
  return Promise.all(
    senders.map(async (sender) => ({
      ...sender.toObject(),
      id: String(sender._id),
      usage: await getSenderHourlyUsage(String(sender._id), sender.hourlyLimit),
    }))
  );
}

async function createSender(userId, { email, name, hourlyLimit, minDelayMs, isDefault }) {
  const normalizedEmail = normalizeEmail(email);
  const existingCount = await SenderAccount.countDocuments({ userId });

  if (isDefault) {
    await SenderAccount.updateMany({ userId, isDefault: true }, { isDefault: false });
  }

  const sender = await SenderAccount.create({
    userId,
    email: normalizedEmail,
    name: name?.trim() || null,
    hourlyLimit: hourlyLimit ?? ENV.DEFAULT_SENDER_HOURLY_LIMIT,
    minDelayMs: minDelayMs ?? 0,
    isActive: true,
    isDefault: isDefault ?? existingCount === 0,
  });

  return {
    ...sender.toObject(),
    id: String(sender._id),
    usage: await getSenderHourlyUsage(String(sender._id), sender.hourlyLimit),
  };
}

async function updateSender(userId, senderId, input) {
  const existing = await SenderAccount.findOne({ _id: senderId, userId });
  if (!existing) throw new AppError(404, 'Sender account not found', 'SENDER_NOT_FOUND');

  if (input.isDefault) {
    await SenderAccount.updateMany({ userId, isDefault: true }, { isDefault: false });
  }

  const updateData = {};
  if (input.name      !== undefined) updateData.name       = input.name?.trim() || null;
  if (input.hourlyLimit !== undefined) updateData.hourlyLimit = input.hourlyLimit;
  if (input.minDelayMs  !== undefined) updateData.minDelayMs  = input.minDelayMs;
  if (input.isActive    !== undefined) updateData.isActive    = input.isActive;
  if (input.isDefault   !== undefined) updateData.isDefault   = input.isDefault;

  const updated = await SenderAccount.findByIdAndUpdate(senderId, updateData, { new: true });

  return {
    ...updated.toObject(),
    id: String(updated._id),
    usage: await getSenderHourlyUsage(String(updated._id), updated.hourlyLimit),
  };
}

async function deleteSender(userId, senderId) {
  const existing = await SenderAccount.findOne({ _id: senderId, userId });
  if (!existing) throw new AppError(404, 'Sender account not found', 'SENDER_NOT_FOUND');

  const totalCount = await SenderAccount.countDocuments({ userId });
  if (totalCount <= 1) {
    throw new AppError(400, 'At least one sender account is required for your workspace.', 'CANNOT_DELETE_LAST_SENDER');
  }

  await SenderAccount.findByIdAndDelete(senderId);

  if (existing.isDefault) {
    const nextSender = await SenderAccount.findOne({ userId }).sort({ createdAt: 1 });
    if (nextSender) await SenderAccount.findByIdAndUpdate(nextSender._id, { isDefault: true });
  }
}

module.exports = { ensureDefaultSender, listSendersWithUsage, createSender, updateSender, deleteSender };
