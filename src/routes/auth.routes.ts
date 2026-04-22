import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import {
  createConnectorAuthSession,
  getConnectorAuthSessionContext,
  getConnectorAuthSessionStatus,
  handleConnectorAuthCallback,
  verifyConnectorAuthSession,
} from '../controllers/connectorAuth.controller';
import { authenticateToken } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// ============================================
// PUBLIC AUTHENTICATION ROUTES
// No authentication required for these endpoints
// ============================================

// Validation chains
const registerValidation = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
    .isLength({ max: 255 })
    .withMessage('Email cannot exceed 255 characters'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('consent.termsAccepted')
    .isBoolean()
    .equals('true')
    .withMessage('You must accept the terms and conditions'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isString()
    .notEmpty()
    .withMessage('Password is required'),
];

const refreshTokenValidation = [
  body('refreshToken')
    .isString()
    .notEmpty()
    .withMessage('Refresh token is required'),
];

const createSessionValidation = [
  body('connectorId')
    .isMongoId()
    .withMessage('Valid connectorId is required'),
  body('deviceId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('deviceId must be between 2 and 120 characters'),
  body('platform')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('platform must be between 2 and 50 characters'),
  body('redirectUri')
    .optional()
    .isURL({ require_protocol: true })
    .withMessage('redirectUri must be a valid URL'),
];

const callbackValidation = [
  body('sessionId')
    .isString()
    .notEmpty()
    .withMessage('sessionId is required'),
  body('state')
    .isString()
    .notEmpty()
    .withMessage('state is required'),
  body('code')
    .optional()
    .isString()
    .notEmpty()
    .withMessage('code must be a non-empty string when provided'),
  body('error')
    .optional()
    .isString()
    .trim(),
  body('errorDescription')
    .optional()
    .isString()
    .trim(),
  body('error_description')
    .optional()
    .isString()
    .trim(),
];

const sessionStatusValidation = [
  param('sessionId')
    .isString()
    .notEmpty()
    .withMessage('sessionId is required'),
];

const sessionVerifyValidation = [
  param('sessionId')
    .isString()
    .notEmpty()
    .withMessage('sessionId is required'),
  query('state')
    .isString()
    .notEmpty()
    .withMessage('state is required'),
];

const sessionContextValidation = [
  param('sessionId')
    .isString()
    .notEmpty()
    .withMessage('sessionId is required'),
  query('state')
    .isString()
    .notEmpty()
    .withMessage('state is required'),
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
];

const resetPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/admin/auth/register
 * Register new user (First-time setup in Sovereign AI app)
 * Public endpoint - No authentication required
 */
router.post(
  '/register',
  writeLimiter,
  registerValidation,
  validate,
  usersController.registerUser
);

/**
 * POST /api/admin/auth/login
 * Login existing user
 * Public endpoint - No authentication required
 */
router.post(
  '/login',
  writeLimiter,
  loginValidation,
  validate,
  usersController.loginUser
);

/**
 * POST /api/admin/auth/refresh
 * Refresh session token using refresh token
 * Public endpoint - No authentication required (uses refresh token)
 */
router.post(
  '/refresh',
  writeLimiter,
  refreshTokenValidation,
  validate,
  usersController.refreshSession
);

/**
 * POST /api/auth/create-session
 * Create a short-lived connector auth session
 */
router.post(
  '/create-session',
  writeLimiter,
  authenticateToken,
  createSessionValidation,
  validate,
  createConnectorAuthSession
);

/**
 * GET /api/auth/session/:sessionId/verify
 * Secure handshake for portal to verify session and get connector metadata
 */
router.get(
  '/session/:sessionId/verify',
  authenticateToken,
  sessionVerifyValidation,
  validate,
  verifyConnectorAuthSession
);

/**
 * GET /api/auth/session/:sessionId/context
 * Fetch connector/auth/user context after session verification
 */
router.get(
  '/session/:sessionId/context',
  authenticateToken,
  sessionContextValidation,
  validate,
  getConnectorAuthSessionContext
);

/**
 * GET /api/auth/session/:sessionId
 * Poll current auth session status
 */
router.get(
  '/session/:sessionId',
  authenticateToken,
  sessionStatusValidation,
  validate,
  getConnectorAuthSessionStatus
);

/**
 * GET /api/auth/handle/:provider
 * Direct OAuth provider callback (GET)
 */
router.get(
  '/handle/:provider',
  handleConnectorAuthCallback
);

/**
 * POST /api/auth/callback
 * Hosted portal callback after OAuth completion (Legacy or custom)
 */
router.post(
  '/callback',
  writeLimiter,
  callbackValidation,
  validate,
  handleConnectorAuthCallback
);

/**
 * POST /api/auth/forgot-password
 * Request password reset token
 */
router.post(
  '/forgot-password',
  writeLimiter,
  forgotPasswordValidation,
  validate,
  usersController.forgotPassword
);

/**
 * PATCH /api/auth/reset-password
 * Reset password using email directly (Simple version)
 */
router.patch(
  '/reset-password',
  writeLimiter,
  resetPasswordValidation,
  validate,
  usersController.resetPassword
);

/**
 * GET /api/admin/auth/verify
 * Verify current session token
 * Protected endpoint - Requires valid session token
 */
router.get(
  '/verify',
  authenticateToken,
  usersController.verifySession
);

/**
 * POST /api/auth/revoke-plan
 * Revoke current user's plan and move to free tier
 */
router.post(
  '/revoke-plan',
  authenticateToken,
  writeLimiter,
  usersController.revokePlan
);

export default router;
