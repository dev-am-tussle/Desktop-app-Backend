import { Router } from 'express';
import { body } from 'express-validator';
import {
  adminLogin,
  adminRefreshToken,
  verifyAdminToken,
  adminLogout,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from '../controllers/admin.controller';
import { authenticateAdminToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ============================================

/**
 * POST /admin/auth/login
 * Admin login
 */
router.post(
  '/auth/login',
  writeLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  adminLogin
);

/**
 * POST /admin/auth/refresh
 * Refresh admin access token
 */
router.post(
  '/auth/refresh',
  writeLimiter,
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  adminRefreshToken
);

// ============================================
// PROTECTED ROUTES (AUTH REQUIRED)
// ============================================

/**
 * GET /admin/auth/verify
 * Verify admin token validity
 */
router.get('/auth/verify', readLimiter, authenticateAdminToken, verifyAdminToken);

/**
 * POST /admin/auth/logout
 * Admin logout
 */
router.post('/auth/logout', writeLimiter, authenticateAdminToken, adminLogout);

/**
 * GET /admin/profile
 * Get current admin profile
 */
router.get('/profile', readLimiter, authenticateAdminToken, getAdminProfile);

/**
 * PUT /admin/profile
 * Update current admin profile
 */
router.put(
  '/profile',
  writeLimiter,
  authenticateAdminToken,
  [
    body('name').optional().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  ],
  validate,
  updateAdminProfile
);

/**
 * POST /admin/change-password
 * Change current admin password
 */
router.post(
  '/change-password',
  writeLimiter,
  authenticateAdminToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  ],
  validate,
  changeAdminPassword
);

export default router;
