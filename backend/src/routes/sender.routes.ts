import { Router } from 'express';
import { z } from 'zod';
import * as senderController from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const senderRouter = Router();

senderRouter.use(requireAuth);

const createSenderSchema = z.object({
  email: z.string().email('Valid sender email is required'),
  name: z.string().trim().max(100).optional(),
  hourlyLimit: z.number().int().min(1).max(100_000).optional(),
  minDelayMs: z.number().int().min(0).max(60_000).optional(),
  isDefault: z.boolean().optional(),
});

const updateSenderSchema = z.object({
  name: z.string().trim().max(100).optional(),
  hourlyLimit: z.number().int().min(1).max(100_000).optional(),
  minDelayMs: z.number().int().min(0).max(60_000).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

senderRouter.get('/', asyncHandler(senderController.listSenders));
senderRouter.post('/', validateBody(createSenderSchema), asyncHandler(senderController.createSender));
senderRouter.patch(
  '/:id',
  validateBody(updateSenderSchema),
  asyncHandler(senderController.updateSender)
);
senderRouter.delete('/:id', asyncHandler(senderController.deleteSender));
