import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getDashboardMetrics } from '../controllers/dashboardController.js';

const router = Router();

router.get('/metrics', authenticate, authorize('admin'), asyncHandler(getDashboardMetrics));

export default router;
