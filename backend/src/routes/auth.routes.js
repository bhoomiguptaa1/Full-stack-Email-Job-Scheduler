const { Router } = require('express');
const { z } = require('zod');
const authController = require('../controllers/auth.controller');
const { createHttpRateLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { ENV } = require('../config/env');

const authRouter = Router();

const authLimiter = createHttpRateLimiter({
  keyPrefix: 'auth',
  windowSeconds: 60,
  maxRequests: ENV.AUTH_RATE_LIMIT_MAX,
});

const registerSchema = z.object({
  email:    z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name:     z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email:    z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const demoLoginSchema = z.object({
  email: z.string().email().optional(),
  name:  z.string().min(1).max(80).optional(),
});

authRouter.post('/register', authLimiter, validateBody(registerSchema), asyncHandler(authController.register));
authRouter.post('/login',    authLimiter, validateBody(loginSchema),    asyncHandler(authController.login));
authRouter.post('/demo-login', authLimiter, validateBody(demoLoginSchema), asyncHandler(authController.demoLogin));
authRouter.get('/me', requireAuth, asyncHandler(authController.getMe));

module.exports = { authRouter };
