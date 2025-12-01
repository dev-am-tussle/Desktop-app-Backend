import { Router } from 'express';
import { body } from 'express-validator';
import {
  registerPublicUser,
  loginPublicUser,
  getPublicPlans,
  getPublicUserProfile,
  choosePlan,
  processPayment,
} from '../controllers/public.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================

/**
 * POST /public/register
 * Register new user with free trial
 */
router.post(
  '/register',
  writeLimiter,
  [
    body('name').notEmpty().withMessage('Name is required').trim(),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  validate,
  registerPublicUser
);

/**
 * POST /public/login
 * User login
 */
router.post(
  '/login',
  writeLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  loginPublicUser
);

/**
 * GET /public/plans
 * Get all active subscription plans (no auth)
 */
router.get('/plans', readLimiter, getPublicPlans);

// ============================================
// PROTECTED ROUTES (Auth Required)
// ============================================

/**
 * GET /public/profile
 * Get user profile
 */
router.get('/profile', readLimiter, authenticateToken, getPublicUserProfile);

/**
 * POST /public/choose-plan
 * User chooses a plan (doesn't pay yet)
 */
router.post(
  '/choose-plan',
  writeLimiter,
  authenticateToken,
  [body('planId').notEmpty().withMessage('Plan ID is required')],
  validate,
  choosePlan
);

/**
 * POST /public/payment
 * Process payment for chosen plan
 */
router.post(
  '/payment',
  writeLimiter,
  authenticateToken,
  [
    body('planId').notEmpty().withMessage('Plan ID is required'),
    body('paymentMethod')
      .isIn(['card', 'paypal', 'crypto', 'upi'])
      .withMessage('Invalid payment method'),
  ],
  validate,
  processPayment
);

export default router;
