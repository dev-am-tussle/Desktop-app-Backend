import { Request, Response, NextFunction } from 'express';
import CouponService from '../services/coupon.service';
import { AppError } from '../middleware/errorHandler';
import { User } from '../models';
import { getSubscriptionDetails } from '../utils/userHelpers';

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

    // Fetch refreshed user to get updated plan_id and subscription state
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found after redemption', 404, 'USER_NOT_FOUND');
    }

    // Get complete subscription details using standard architecture
    const subscriptionDetails = await getSubscriptionDetails(user);

    res.status(200).json({
      success: true,
      message: result.message,
      data: subscriptionDetails
    });
  } catch (error) {
    next(error);
  }
};