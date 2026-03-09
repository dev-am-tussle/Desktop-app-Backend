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
  createAdmin,
  createEntitlementDefinition,
  getEntitlementDefinitions,
  updateEntitlementDefinition,
  deleteEntitlementDefinition,
  createPlanWithEntitlements,
  createCoupon,
  getCoupons,
  getCouponByCode,
  getCouponRedemptions,
  revokeCoupon,
  deleteCoupon,
  getPlanEntitlements,
  updatePlanStatus,
} from '../controllers/admin.controller';
import { getUserTelemetry, getLatestUserTelemetry } from '../controllers/admin.telemetry.controller';
import { authenticateAdminToken, requireAdminRole } from '../middleware/auth';
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

/**
 * POST /admin/admins
 * Create a new admin/support user (admin-only)
 */
router.post(
  '/admins',
  writeLimiter,
  authenticateAdminToken,
  requireAdminRole(['admin']),
  [
    body('name').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('role').optional().isIn(['admin', 'support']).withMessage('Role must be admin or support'),
    body('status').optional().isIn(['active', 'disabled']).withMessage('Status must be active or disabled'),
  ],
  validate,
  createAdmin
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
 * Create subscription plan with MULTI-CURRENCY entitlements in one request
 * 
 * PAYLOAD STRUCTURE:
 * {
 *   "plan": {
 *     "name": "pro",
 *     "display_name": "Pro Plan",
 *     "slug": "pro-plan",
 *     "base_amount_monthly": 1999,    // AUD in cents
 *     "base_amount_yearly": 19999,
 *     "target_regions": [
 *       { "currency": "AUD", "custom_amount_monthly": 1999 },
 *       { "currency": "USD" },  // Will auto-convert
 *       { "currency": "INR", "custom_amount_monthly": 129900 }
 *     ],
 *     "features": [...],
 *     "category": "personal",
 *     "is_contact_sales": false
 *   },
 *   "entitlements": [...]
 * }
 */
router.post(
  '/plans/create-with-entitlements',
  writeLimiter,
  authenticateAdminToken,
  [
    // Plan object validation
    body('plan').notEmpty().withMessage('Plan object is required'),
    body('plan.name').notEmpty().isString().withMessage('Plan name is required and must be a string'),
    body('plan.display_name').notEmpty().isString().withMessage('Plan display name is required'),
    body('plan.slug').notEmpty().isString().withMessage('Plan slug is required'),
    body('plan.description').optional().isString().withMessage('Description must be a string'),
    
    // Multi-currency pricing validation (Leniency for prices object)
    body('plan.base_amount_monthly').optional().isInt({ min: 0 }),
    body('plan.base_amount_yearly').optional().isInt({ min: 0 }),
    body('plan.target_regions').optional().isArray(),
    
    // New Prices Object Validation (Frontend structure)
    body('plan.prices').optional().isObject().withMessage('Prices must be an object'),
    body('plan.prices.monthly').optional().isObject().withMessage('Monthly prices must be an object'),
    
    // Features and metadata
    body('plan.features').optional().isArray().withMessage('Features must be an array'),
    body('plan.features.*').optional().isString().withMessage('Each feature must be a string'),
    body('plan.category').optional().isIn(['personal', 'business', 'enterprise']).withMessage('Category must be personal, business, or enterprise'),
    body('plan.is_contact_sales').optional().isBoolean().withMessage('is_contact_sales must be a boolean'),
    body('plan.sort_order').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
    
    // Entitlements validation
    body('entitlements').isArray().withMessage('Entitlements must be an array'),
    body('entitlements.*.entitlement_key').notEmpty().isString().withMessage('Each entitlement must have a key'),
    body('entitlements.*.value').notEmpty().withMessage('Each entitlement must have a value'),
  ],
  validate,
  createPlanWithEntitlements
);

/**
 * GET /admin/plans/:id/entitlements
 * Get specific plan with all its entitlements
 */
router.get(
  '/plans/:id/entitlements',
  readLimiter,
  authenticateAdminToken,
  getPlanEntitlements
);

/**
 * PATCH /admin/plans/:id/status
 * Enable or Disable a plan (hide from app)
 */
router.patch(
  '/plans/:id/status',
  writeLimiter,
  authenticateAdminToken,
  [
    body('status').isIn(['active', 'disabled']).withMessage('Status must be active or disabled'),
  ],
  validate,
  updatePlanStatus
);

// ============================================
// COUPON MANAGEMENT ROUTES
// ============================================

/**
 * POST /admin/coupons
 * Create a new coupon
 */
router.post(
  '/coupons',
  writeLimiter,
  authenticateAdminToken,
  [
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('validity').isInt({ min: 1 }).withMessage('Validity must be a positive integer'),
    body('max_redemptions').isInt({ min: 1 }).withMessage('Max redemptions must be a positive integer'),
    body('max_redemptions_per_user').isInt({ min: 1 }).withMessage('Max redemptions per user must be a positive integer'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('expires_at').isISO8601().withMessage('Expires at must be a valid date'),
    body('type').isIn(['plan', 'custom']).withMessage('Type must be plan or custom'),
    body('plan_id').if(body('type').equals('plan')).notEmpty().withMessage('Plan ID is required for plan type coupons'),
    body('entitlements').if(body('type').equals('custom')).notEmpty().withMessage('Entitlements are required for custom type coupons'),
    body('status').optional().isIn(['active', 'disabled']).withMessage('Status must be active or disabled'),
    body('metadata').optional().isArray().withMessage('Metadata must be an array'),
  ],
  validate,
  createCoupon
);

/**
 * GET /admin/coupons
 * Get all coupons
 */
router.get(
  '/coupons',
  readLimiter,
  authenticateAdminToken,
  getCoupons
);

/**
 * GET /admin/coupons/:code
 * Get coupon by code
 */
router.get(
  '/coupons/:code',
  readLimiter,
  authenticateAdminToken,
  getCouponByCode
);

/**
 * GET /admin/coupons/:code/redemptions
 * Get redemptions for a specific coupon
 */
router.get(
  '/coupons/:code/redemptions',
  readLimiter,
  authenticateAdminToken,
  getCouponRedemptions
);

/**
 * PUT /admin/coupons/:code/revoke
 * Revoke/Disable a coupon
 */
router.put(
  '/coupons/:code/revoke',
  writeLimiter,
  authenticateAdminToken,
  revokeCoupon
);

/**
 * DELETE /admin/coupons/:code
 * Delete a coupon (if not redeemed)
 */
router.delete(
  '/coupons/:code',
  writeLimiter,
  authenticateAdminToken,
  deleteCoupon
);

// ============================================
// USER TELEMETRY ROUTES (ADMIN ONLY)
// ============================================

/**
 * GET /admin/users/:id/telemetry
 * Get all telemetry history for a specific user
 */
router.get(
  '/users/:id/telemetry',
  readLimiter,
  authenticateAdminToken,
  getUserTelemetry
);

/**
 * GET /admin/users/:id/telemetry/latest
 * Get only the latest telemetry snapshot for a user
 */
router.get(
  '/users/:id/telemetry/latest',
  readLimiter,
  authenticateAdminToken,
  getLatestUserTelemetry
);

export default router;
