import { Router } from 'express';
import {
  getDashboardStats,
  getRecentActivity,
  getSignupsChart,
  getRevenueChart,
} from '../controllers/dashboard.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { readLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /dashboard/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  readLimiter,
  authenticateToken,
  requireRole(['admin']),
  getDashboardStats
);

/**
 * GET /dashboard/activity
 * Get recent activity feed
 */
router.get(
  '/activity',
  readLimiter,
  authenticateToken,
  requireRole(['admin']),
  getRecentActivity
);

/**
 * GET /dashboard/charts/signups
 * Get signups chart data
 */
router.get(
  '/charts/signups',
  readLimiter,
  authenticateToken,
  requireRole(['admin']),
  getSignupsChart
);

/**
 * GET /dashboard/charts/revenue
 * Get revenue chart data
 */
router.get(
  '/charts/revenue',
  readLimiter,
  authenticateToken,
  requireRole(['admin']),
  getRevenueChart
);

export default router;

