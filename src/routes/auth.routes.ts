import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import { authenticateToken } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';

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
 * GET /api/admin/auth/verify
 * Verify current session token
 * Protected endpoint - Requires valid session token
 */
router.get(
  '/verify',
  authenticateToken,
  usersController.verifySession
);

export default router;
