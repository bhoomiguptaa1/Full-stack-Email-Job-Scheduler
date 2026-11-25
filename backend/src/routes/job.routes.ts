import { Router } from 'express';
import { z } from 'zod';
import * as jobController from '../controllers/job.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const jobRouter = Router();

jobRouter.use(requireAuth);

const recurrenceEnum = z.enum([
  'NONE',
  'EVERY_HOUR',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'CUSTOM_REPEAT',
]);

const scheduleSchema = z
  .object({
    recipientEmail: z.string().email('Valid recipient email is required').optional(),
    recipients: z.array(z.string().email('All recipients must be valid email addresses')).max(100).optional(),
    subject: z.string().trim().min(1, 'Subject is required').max(255),
    body: z.string().trim().min(1, 'Body is required').max(100_000),
    scheduledFor: z.string().datetime({ offset: true }).optional(),
    delaySeconds: z.number().min(0).max(365 * 24 * 3600).optional(),
    staggerDelayMs: z.number().min(0).max(3600_000).optional(),
    recurrence: recurrenceEnum.optional(),
    repeatIntervalMs: z.number().int().min(1000).optional(),
    senderId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  })
  .refine((data) => Boolean(data.recipientEmail || (data.recipients && data.recipients.length > 0)), {
    message: 'recipientEmail or recipients is required',
    path: ['recipientEmail'],
  });

const rescheduleSchema = z.object({
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  delaySeconds: z.number().min(0).max(365 * 24 * 3600).optional(),
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query "q" is required').max(200),
  status: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

jobRouter.post('/schedule', validateBody(scheduleSchema), asyncHandler(jobController.scheduleJobs));
jobRouter.get('/', asyncHandler(jobController.listJobs));
jobRouter.get('/search', validateQuery(searchQuerySchema), asyncHandler(jobController.searchJobs));
jobRouter.get('/:id', asyncHandler(jobController.getJob));
jobRouter.patch(
  '/:id/reschedule',
  validateBody(rescheduleSchema),
  asyncHandler(jobController.rescheduleJob)
);
jobRouter.delete('/:id', asyncHandler(jobController.cancelJob));
