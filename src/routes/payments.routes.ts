import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { readLimiter, writeLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import * as paymentsController from '../controllers/payments.controller';

const router = Router();

// Validation chains
const getPaymentsValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['completed', 'pending', 'failed', 'refunded']),
  query('userId').optional().isMongoId(),
];

const getPaymentByIdValidation = [param('id').isMongoId().withMessage('Invalid payment ID')];

const createPaymentValidation = [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .toUpperCase()
    .withMessage('Currency must be a 3-letter ISO code'),
  body('method')
    .isIn(['card', 'paypal', 'crypto', 'bank_transfer', 'other'])
    .withMessage('Invalid payment method'),
  body('status').optional().isIn(['completed', 'pending', 'failed', 'refunded']),
  body('transactionId').optional().isString().trim(),
];

const updatePaymentValidation = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('status').optional().isIn(['completed', 'pending', 'failed', 'refunded']),
  body('transactionId').optional().isString().trim(),
  body('metadata').optional().isObject(),
];

const refundPaymentValidation = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('reason').optional().isString().trim(),
];

// ============================================
// PUBLIC PAYMENT ENDPOINTS - Desktop App
// ============================================
// IMPORTANT: These must come BEFORE admin routes
// to avoid route matching conflicts

/**
 * POST /payments/create-checkout-session
 * Create Stripe checkout session for desktop app
 * Public (authenticated user) - Desktop app calls this to initiate payment
 */
router.post(
  '/create-checkout-session',
  authenticateToken,
  writeLimiter,
  [body('planId').isMongoId().withMessage('Valid plan ID is required')],
  validate,
  paymentsController.createCheckoutSession
);

/**
 * GET /payments/subscription-status
 * Get user's subscription status
 * Public (authenticated user) - Desktop app verifies payment status
 */
router.get(
  '/subscription-status',
  authenticateToken,
  readLimiter,
  paymentsController.getSubscriptionStatus
);

/**
 * POST /payments/process
 * Process payment and activate subscription
 * Public (authenticated user) - Desktop app calls after payment success
 */
router.post(
  '/process',
  authenticateToken,
  writeLimiter,
  [
    body('planId').isMongoId().withMessage('Valid plan ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paymentMethod')
      .isIn(['card', 'paypal', 'crypto', 'bank_transfer', 'other'])
      .withMessage('Invalid payment method'),
    body('transactionId').notEmpty().isString().withMessage('Transaction ID is required'),
  ],
  validate,
  paymentsController.processPayment
);

/**
 * POST /payments/activate-free
 * Activate free plan without payment
 * Public (authenticated user) - Desktop app calls for free plans
 */
router.post(
  '/activate-free',
  authenticateToken,
  writeLimiter,
  [body('planId').isMongoId().withMessage('Valid plan ID is required')],
  validate,
  paymentsController.activateFreePlan
);

// ============================================
// ADMIN PAYMENT ENDPOINTS
// ============================================

// Routes
router.get(
  '/',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getPaymentsValidation,
  validate,
  paymentsController.getPayments
);

router.get(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getPaymentByIdValidation,
  validate,
  paymentsController.getPaymentById
);

router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  createPaymentValidation,
  validate,
  paymentsController.createPayment
);

router.put(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  updatePaymentValidation,
  validate,
  paymentsController.updatePayment
);

router.post(
  '/:id/refund',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  refundPaymentValidation,
  validate,
  paymentsController.refundPayment
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  getPaymentByIdValidation,
  validate,
  paymentsController.deletePayment
);

export default router;
