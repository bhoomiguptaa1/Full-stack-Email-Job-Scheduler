import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '../config/redis';

interface RateLimitOptions {
  keyPrefix: string;
  windowSeconds: number;
  maxRequests: number;
}

const memoryHits = new Map<string, { count: number; resetAt: number }>();

const SLIDING_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { current, ttl }
`;

export function createHttpRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.user?.id || req.ip || 'unknown';
    const key = `reachinbox:http_rl:${options.keyPrefix}:${identifier}`;

    let count = 0;
    let ttlSeconds = options.windowSeconds;

    try {
      if (redisConnection.status === 'ready') {
        const result = (await redisConnection.eval(
          SLIDING_SCRIPT,
          1,
          key,
          options.windowSeconds
        )) as [number, number];
        count = Number(result[0]);
        ttlSeconds = Math.max(1, Number(result[1]));
      } else {
        throw new Error('Redis unavailable');
      }
    } catch {
      const now = Date.now();
      const existing = memoryHits.get(key);
      if (!existing || existing.resetAt <= now) {
        count = 1;
        memoryHits.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 });
        ttlSeconds = options.windowSeconds;
      } else {
        existing.count += 1;
        count = existing.count;
        ttlSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      }
    }

    const remaining = Math.max(0, options.maxRequests - count);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(ttlSeconds));

    if (count > options.maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down and try again shortly.',
        code: 'RATE_LIMITED',
      });
      return;
    }

    next();
  };
}
