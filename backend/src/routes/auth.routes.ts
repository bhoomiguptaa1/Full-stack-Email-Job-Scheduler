import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ENV } from '../config/env';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createHttpRateLimiter } from '../middleware/rateLimit.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

const authLimiter = createHttpRateLimiter({
  keyPrefix: 'auth',
  windowSeconds: 60,
  maxRequests: ENV.AUTH_RATE_LIMIT_MAX,
});

const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const demoLoginSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(80).optional(),
});

const slackSettingsSchema = z.object({
  slackChannelId: z.string().min(1).nullable().optional(),
  slackNotificationsEnabled: z.boolean().optional(),
});

// Attach user context if Authorization header is valid so Slack OAuth state carries userId
function attachOptionalUser(req: Parameters<typeof asyncHandler>[0] extends (a: infer R, ...args: never[]) => unknown ? R : never) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7).trim(), ENV.JWT_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        name: null,
        avatarUrl: null,
        role: decoded.role,
        googleConnected: false,
        slackConnected: false,
        slackTeamName: null,
        slackChannelId: null,
        slackNotificationsEnabled: false,
        createdAt: new Date(),
      };
    } catch {
      // Ignore invalid optional token
    }
  }
}

authRouter.get(
  '/urls',
  asyncHandler(async (req, res) => {
    attachOptionalUser(req);
    return authController.getOAuthUrls(req, res);
  })
);

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(authController.register)
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login)
);

authRouter.post(
  '/demo-login',
  authLimiter,
  validateBody(demoLoginSchema),
  asyncHandler(authController.demoLogin)
);

authRouter.get('/google/callback', asyncHandler(authController.googleCallback));
authRouter.get('/slack/callback', asyncHandler(authController.slackCallback));

authRouter.get('/me', requireAuth, asyncHandler(authController.getMe));
authRouter.get('/slack/channels', requireAuth, asyncHandler(authController.listSlackChannels));
authRouter.patch(
  '/slack/settings',
  requireAuth,
  validateBody(slackSettingsSchema),
  asyncHandler(authController.updateSlackSettings)
);
