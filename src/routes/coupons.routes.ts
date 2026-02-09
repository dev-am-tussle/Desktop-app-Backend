import { Router } from 'express';
import { body } from 'express-validator';
import { redeemCoupon } from '../controllers/coupon.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { writeLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================
// USER COUPON ROUTES
// ============================================

/**
 * POST /api/coupons/redeem
 * Redeem a coupon code
 */
router.post(
  '/redeem',
  writeLimiter,
  authenticateToken,
  [
    body('coupon_code').notEmpty().withMessage('Coupon code is required'),
    body('device_id').optional().isString().withMessage('Device ID must be a string'),
  ],
  validate,
  redeemCoupon
);

export default router;