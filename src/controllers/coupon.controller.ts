import { Request, Response, NextFunction } from 'express';
import CouponService from '../services/coupon.service';
import { AppError } from '../middleware/errorHandler';

/**
 * Redeem Coupon
 * User redeems a coupon code to get plan entitlements
 */
export const redeemCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { coupon_code, device_id } = req.body;
    const userId = (req as any).user.userId;

    if (!coupon_code) {
      throw new AppError('Coupon code is required', 400, 'COUPON_CODE_REQUIRED');
    }

    const result = await CouponService.redeemCoupon(userId, coupon_code, device_id);

    // Remove definitions from the entitlement snapshot as per user request
    if (result.snapshot && (result.snapshot as any).definitions) {
      delete (result.snapshot as any).definitions;
    } 

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        plan: result.plan,
        expires_at: result.expires_at,
        entitlement: result.snapshot,
      }
    });
  } catch (error) {
    next(error);
  }
};