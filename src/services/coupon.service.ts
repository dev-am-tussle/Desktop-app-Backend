import { Coupon, CouponRedemption, User, SubscriptionPlan, UserEntitlementOverride } from '../models';
import entitlementsService from './entitlements.service';

export interface CreateCouponDTO {
  code: string;
  validity: number;
  max_redemptions: number;
  max_redemptions_per_user: number;
  description: string;
  expires_at: string;
  type: 'plan' | 'custom';
  plan_id?: string;
  entitlements?: any;
  status: 'active' | 'disabled';
  metadata?: any[];
  createdBy: string;
}

class CouponService {
  /**
   * Create a new coupon (Admin only)
   */
  public async createCoupon(data: CreateCouponDTO) {
    // Check if code already exists
    const existing = await Coupon.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw new Error('Coupon code already exists');
    }

    // Validate plan_id if type is plan
    if (data.type === 'plan') {
      if (!data.plan_id) throw new Error('plan_id is required for plan type coupons');
      const plan = await SubscriptionPlan.findById(data.plan_id);
      if (!plan) throw new Error('Invalid subscription plan ID');
    }

    // Validate entitlements if type is custom
    if (data.type === 'custom' && !data.entitlements) {
      throw new Error('entitlements are required for custom type coupons');
    }

    const coupon = new Coupon({
      ...data,
      code: data.code.toUpperCase(),
      expires_at: new Date(data.expires_at),
    });

    return await coupon.save();
  }

  /**
   * Redeem a coupon for a user
   */
  public async redeemCoupon(userId: string, code: string, deviceId?: string) {
    // Note: Transactions are problematic with certain Cosmos DB tiers/configurations
    // We'll perform operations sequentially for maximum compatibility
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const coupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (!coupon) throw new Error('Invalid coupon code');

      // 1. Validation
      if (coupon.status !== 'active') throw new Error('Coupon is not active');
      if (new Date() > coupon.expires_at) {
        coupon.status = 'expired';
        await coupon.save();
        throw new Error('Coupon has expired');
      }
      if (coupon.redeemed_count >= coupon.max_redemptions) {
        throw new Error('Coupon redemption limit reached');
      }

      // Check per-user limit
      const userRedemptions = await CouponRedemption.countDocuments({
        coupon_id: coupon._id,
        user_id: user._id,
      });

      if (userRedemptions >= coupon.max_redemptions_per_user) {
        throw new Error('You have already reached the redemption limit for this coupon');
      }

      // 2. Apply Plan Entitlement
      if (coupon.type === 'plan' && coupon.plan_id) {
        const plan = await SubscriptionPlan.findById(coupon.plan_id);
        if (!plan) throw new Error('Applied plan no longer exists');

        // Calculate expiry date
        const now = new Date();
        const expiryDate = new Date(now.getTime() + coupon.validity * 24 * 60 * 60 * 1000);

        // Update User
        user.plan_id = coupon.plan_id;
        user.subscription_status = 'active';
        user.subscription_ends_at = expiryDate;
        user.stripeSubscriptionId = undefined; 
        
        // Add coupon-user tag if not already present
        if (!user.tags) user.tags = [];
        if (!user.tags.includes('coupon-user')) {
          user.tags.push('coupon-user');
        }
        
        await user.save();

        // 3. Record Redemption
        const redemption = new CouponRedemption({
          coupon_id: coupon._id,
          user_id: user._id,
          device_id: deviceId,
          plan_id: coupon.plan_id,
          expires_at: expiryDate,
        });
        await redemption.save();

        // 4. Update Coupon Stats
        coupon.redeemed_count += 1;
        await coupon.save();

        // 5. Return signed entitlement
        const snapshot = await entitlementsService.resolveUserEntitlements(user._id);

        // Override plan details in snapshot for better identification
        snapshot.plan_id = coupon._id.toString();
        snapshot.plan_name = 'coupon';

        return {
          message: 'Coupon redeemed successfully',
          plan: plan,
          expires_at: expiryDate,
          snapshot,
        };
      } else if (coupon.type === 'custom' && coupon.entitlements) {
        // Calculate expiry date
        const now = new Date();
        const expiryDate = new Date(now.getTime() + coupon.validity * 24 * 60 * 60 * 1000);

        // 2. Apply Custom Overrides
        await UserEntitlementOverride.deleteMany({ user_id: user._id });

        const categories = ['capabilities', 'deployment', 'limits', 'resources', 'support'];
        const overrideRecords = [];

        for (const category of categories) {
          const items = (coupon.entitlements as any)[category] || [];
          for (const item of items) {
            overrideRecords.push({
              user_id: user._id,
              entitlement_key: item.entitlement_key,
              value: item.value,
              reason: `Coupon: ${coupon.code}`,
              expires_at: expiryDate,
              created_by: coupon.createdBy,
            });
          }
        }

        if (overrideRecords.length > 0) {
          await UserEntitlementOverride.insertMany(overrideRecords);
        }

        // Update User state
        user.plan_id = undefined;
        user.subscription_status = 'active';
        user.subscription_ends_at = expiryDate;
        user.stripeSubscriptionId = undefined;
        
        // Add coupon-user tag if not already present
        if (!user.tags) user.tags = [];
        if (!user.tags.includes('coupon-user')) {
          user.tags.push('coupon-user');
        }
        
        await user.save();

        // 3. Record Redemption
        const redemption = new CouponRedemption({
          coupon_id: coupon._id,
          user_id: user._id,
          device_id: deviceId,
          expires_at: expiryDate,
        });
        await redemption.save();

        // 4. Update Coupon Stats
        coupon.redeemed_count += 1;
        await coupon.save();

        // 5. Return signed entitlement
        const snapshot = await entitlementsService.resolveUserEntitlements(user._id);

        // Override plan details in snapshot to avoid "free" fallback identification
        snapshot.plan_id = coupon._id.toString();
        snapshot.plan_name = 'coupon';

        return {
          message: 'Custom coupon redeemed successfully',
          plan: {
            name: 'custom',
            display_name: 'Custom Individual Plan',
            slug: 'custom-individual-plan',
            description: 'Custom attributes granted via coupon',
            category: 'personal',
            features: []
          },
          expires_at: expiryDate,
          snapshot,
        };
      } else {
        throw new Error('Invalid coupon configuration');
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * List coupons (Admin)
   */
  public async listCoupons() {
    return await Coupon.find().populate('plan_id').sort({ createdAt: -1 });
  }

  /**
   * Get coupon details
   */
  public async getCouponByCode(code: string) {
    return await Coupon.findOne({ code: code.toUpperCase() }).populate('plan_id');
  }

  /**
   * Get redemptions for a specific coupon
   */
  public async getCouponRedemptions(code: string) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) throw new Error('Coupon not found');

    return await CouponRedemption.find({ coupon_id: coupon._id })
      .populate('user_id', 'name email')
      .populate('plan_id', 'name display_name')
      .sort({ redeemed_at: -1 });
  }

  /**
   * Revoke a coupon (Disable it)
   */
  public async revokeCoupon(code: string) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) throw new Error('Coupon not found');

    coupon.status = 'disabled';
    return await coupon.save();
  }

  /**
   * Delete a coupon (Only if not redeemed yet)
   */
  public async deleteCoupon(code: string) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) throw new Error('Coupon not found');

    if (coupon.redeemed_count > 0) {
      throw new Error('Cannot delete coupon because it has already been redeemed by users. Use revoke instead.');
    }

    return await Coupon.deleteOne({ _id: coupon._id });
  }
}

export default new CouponService();
