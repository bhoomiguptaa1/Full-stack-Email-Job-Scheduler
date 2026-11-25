const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const dashboardController = require('../controllers/dashboard.controller');

const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get('/stats', asyncHandler(dashboardController.getStats));

module.exports = { dashboardRouter };
