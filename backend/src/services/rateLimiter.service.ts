import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

export interface QuotaCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetAtMs: number;
  windowKey: string;
}

const CONSUME_QUOTA_LUA = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local limit = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])

if current >= limit then
  local pttl = redis.call("PTTL", KEYS[1])
  if pttl < 0 then pttl = ttlMs end
  return { 0, current, pttl }
end

local nextVal = redis.call("INCR", KEYS[1])
if nextVal == 1 then
  redis.call("PEXPIRE", KEYS[1], ttlMs)
end

local pttl = redis.call("PTTL", KEYS[1])
if pttl < 0 then pttl = ttlMs end
return { 1, nextVal, pttl }
`;

export function getHourWindow(nowMs = Date.now()): {
  windowKey: string;
  ttlMs: number;
  resetAtMs: number;
} {
  const date = new Date(nowMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');

  const nextHourMs = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours() + 1,
    0,
    0,
    0
  );

  const ttlMs = Math.max(1000, nextHourMs - nowMs);
  return {
    windowKey: `${year}${month}${day}${hour}`,
    ttlMs,
    resetAtMs: nextHourMs,
  };
}

export async function consumeSenderHourlyQuota(
  senderId: string,
  hourlyLimit: number,
  nowMs = Date.now()
): Promise<QuotaCheckResult> {
  const { windowKey, ttlMs, resetAtMs } = getHourWindow(nowMs);
  const redisKey = `reachinbox:sender_quota:${senderId}:${windowKey}`;

  if (redisConnection.status !== 'ready') {
    await redisConnection.connect().catch(() => {});
  }

  try {
    const raw = (await redisConnection.eval(
      CONSUME_QUOTA_LUA,
      1,
      redisKey,
      hourlyLimit,
      ttlMs
    )) as [number, number, number];

    const allowed = Number(raw[0]) === 1;
    const currentCount = Number(raw[1]);
    const actualTtl = Math.max(1000, Number(raw[2]));

    return {
      allowed,
      currentCount,
      limit: hourlyLimit,
      remaining: Math.max(0, hourlyLimit - currentCount),
      resetAtMs: nowMs + actualTtl,
      windowKey,
    };
  } catch (error) {
    logger.warn('[RateLimiter] Redis quota check fallback', {
      senderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      allowed: true,
      currentCount: 0,
      limit: hourlyLimit,
      remaining: hourlyLimit,
      resetAtMs,
      windowKey,
    };
  }
}

export async function getSenderHourlyUsage(
  senderId: string,
  hourlyLimit: number,
  nowMs = Date.now()
): Promise<{ sentThisHour: number; hourlyLimit: number; remaining: number; resetAt: string }> {
  const { windowKey, resetAtMs } = getHourWindow(nowMs);
  const redisKey = `reachinbox:sender_quota:${senderId}:${windowKey}`;

  let sentThisHour = 0;
  try {
    if (redisConnection.status === 'ready') {
      const val = await redisConnection.get(redisKey);
      sentThisHour = val ? parseInt(val, 10) || 0 : 0;
    }
  } catch {
    sentThisHour = 0;
  }

  return {
    sentThisHour,
    hourlyLimit,
    remaining: Math.max(0, hourlyLimit - sentThisHour),
    resetAt: new Date(resetAtMs).toISOString(),
  };
}

export async function acquireIdempotencyLock(
  lockKey: string,
  ttlSeconds = 3600
): Promise<boolean> {
  try {
    if (redisConnection.status !== 'ready') {
      return true;
    }
    const result = await redisConnection.set(
      `reachinbox:idemp:${lockKey}`,
      '1',
      'EX',
      ttlSeconds,
      'NX'
    );
    return result === 'OK';
  } catch {
    return true;
  }
}
