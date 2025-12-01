import { Router } from 'express';
import { body } from 'express-validator';
import {
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getSubscriptions,
  getSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  selectPlan,
} from '../controllers/subscriptions.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { readLimiter, writeLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================
// SUBSCRIPTION PLANS ROUTES
// ============================================

/**
 * GET /subscriptions/plans
 * Get all subscription plans
 */
router.get('/plans', readLimiter, getSubscriptionPlans);

/**
 * GET /subscriptions/plans/:id
 * Get subscription plan by ID
 */
router.get('/plans/:id', readLimiter, getSubscriptionPlan);

/**
 * POST /subscriptions/plans
 * Create new subscription plan (admin only)
 */
router.post(
  '/plans',
  writeLimiter,
  authenticateToken,
  requireRole(['admin']),
  [
    body('name').notEmpty().withMessage('Plan name is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('billingPeriod')
      .isIn(['monthly', 'yearly', 'one-time'])
      .withMessage('Invalid billing period'),
  ],
  validate,
  createSubscriptionPlan
);

/**
 * PUT /subscriptions/plans/:id
 * Update subscription plan (admin only)
 */
router.put(
  '/plans/:id',
  writeLimiter,
  authenticateToken,
  requireRole(['admin']),
  updateSubscriptionPlan
);

/**
 * DELETE /subscriptions/plans/:id
 * Archive subscription plan (admin only)
 */
router.delete(
  '/plans/:id',
  writeLimiter,
  authenticateToken,
  requireRole(['admin']),
  deleteSubscriptionPlan
);

// ============================================
// USER SUBSCRIPTION ACTIONS
// ============================================

/**
 * POST /subscriptions/select-plan
 * Select a plan for current user's subscription
 * Public (authenticated user) - Desktop app calls this
 */
router.post(
  '/select-plan',
  writeLimiter,
  authenticateToken,
  [
    body('planId')
      .notEmpty()
      .withMessage('Plan ID is required')
      .isMongoId()
      .withMessage('Invalid plan ID'),
  ],
  validate,
  selectPlan
);

// ============================================
// SUBSCRIPTIONS ROUTES
// ============================================

/**
 * GET /subscriptions
 * Get all subscriptions
 */
router.get(
  '/',
  readLimiter,
  authenticateToken,
  requireRole(['admin']),
  getSubscriptions
);

/**
 * GET /subscriptions/:id
 * Get subscription by ID
 */
router.get(
  '/:id',
  readLimiter,
  authenticateToken,
  requireRole(['admin']),
  getSubscription
);

/**
 * POST /subscriptions/:id/cancel
 * Cancel subscription
 */
router.post(
  '/:id/cancel',
  writeLimiter,
  authenticateToken,
  requireRole(['admin']),
  cancelSubscription
);

/**
 * POST /subscriptions/:id/pause
 * Pause subscription
 */
router.post(
  '/:id/pause',
  writeLimiter,
  authenticateToken,
  requireRole(['admin']),
  pauseSubscription
);

/**
 * POST /subscriptions/:id/resume
 * Resume subscription
 */
router.post(
  '/:id/resume',
  writeLimiter,
  authenticateToken,
  requireRole(['admin']),
  resumeSubscription
);

export default router;

