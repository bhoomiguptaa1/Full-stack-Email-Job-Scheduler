import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/stats', asyncHandler(dashboardController.getStats));
