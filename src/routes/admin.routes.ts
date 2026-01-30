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
  createEntitlementDefinition,
  getEntitlementDefinitions,
  updateEntitlementDefinition,
  deleteEntitlementDefinition,
  createPlanWithEntitlements,
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

// ============================================
// ENTITLEMENT DEFINITIONS MANAGEMENT
// ============================================

/**
 * POST /admin/entitlements/definitions
 * Create new entitlement definition
 */
router.post(
  '/entitlements/definitions',
  writeLimiter,
  authenticateAdminToken,
  [
    body('key').notEmpty().withMessage('Entitlement key is required'),
    body('type').isIn(['boolean', 'number', 'string', 'array']).withMessage('Invalid type'),
    body('category').isIn(['capabilities', 'limits', 'resources', 'deployment', 'support']).withMessage('Invalid category'),
  ],
  validate,
  createEntitlementDefinition
);

/**
 * GET /admin/entitlements/definitions
 * Get all entitlement definitions (with optional filters)
 */
router.get(
  '/entitlements/definitions',
  readLimiter,
  authenticateAdminToken,
  getEntitlementDefinitions
);

/**
 * PUT /admin/entitlements/definitions/:id
 * Update entitlement definition
 */
router.put(
  '/entitlements/definitions/:id',
  writeLimiter,
  authenticateAdminToken,
  updateEntitlementDefinition
);

/**
 * DELETE /admin/entitlements/definitions/:id
 * Delete entitlement definition
 */
router.delete(
  '/entitlements/definitions/:id',
  writeLimiter,
  authenticateAdminToken,
  deleteEntitlementDefinition
);

// ============================================
// PLAN MANAGEMENT WITH ENTITLEMENTS
// ============================================

/**
 * POST /admin/plans/create-with-entitlements
 * Create subscription plan with entitlements in one request
 */
router.post(
  '/plans/create-with-entitlements',
  writeLimiter,
  authenticateAdminToken,
  [
    body('plan').notEmpty().withMessage('Plan object is required'),
    body('plan.name').notEmpty().withMessage('Plan name is required'),
    body('plan.display_name').notEmpty().withMessage('Plan display name is required'),
    body('plan.slug').notEmpty().withMessage('Plan slug is required'),
    body('entitlements').isArray().withMessage('Entitlements must be an array'),
  ],
  validate,
  createPlanWithEntitlements
);

export default router;
