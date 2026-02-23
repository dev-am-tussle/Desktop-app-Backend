import { User, SubscriptionPlan, CouponRedemption } from '../models';
import { Types } from 'mongoose';
import { formatPlanPricing } from './formatters';

/**
 * Get detailed subscription information for a user
 */
export async function getSubscriptionDetails(user: any) {
  const subscriptionStatus = user.subscription_status || 'none';
  
  // Get plan details from user.plan_id
  let planDetails = null;
  if (user.plan_id) {
    const plan = await SubscriptionPlan.findById(user.plan_id).lean();
    if (plan) {
      planDetails = formatPlanPricing({
        ...plan,
        id: (plan as any)._id,
      });
    }
  }

  let subscription_type = 'free';
  if (user.stripeSubscriptionId) {
    subscription_type = 'paid';
  }

  // Handle coupon-based subscription - Priority over standard plan display if active via coupon
  if (user.subscription_status === 'active' && !user.stripeSubscriptionId) {
    const lastRedemption = await CouponRedemption.findOne({ user_id: user._id }).sort({ redeemed_at: -1 });
    if (lastRedemption) {
      subscription_type = 'coupon';
      planDetails = {
        ...(planDetails || {}),
        id: lastRedemption.coupon_id,
        name: 'coupon',
        display_name: planDetails?.display_name || 'Custom Individual Plan (Coupon)',
        slug: 'coupon-access',
        description: 'Access granted via coupon redemption',
        category: 'personal',
        features: planDetails?.features || []
      };
    }
  }

  // Add subscription_type to planDetails if it exists
  if (planDetails) {
    planDetails.subscription_type = subscription_type;
  }

  return {
    status: subscriptionStatus,
    subscription_ends_at: user.subscription_ends_at || null,
    grace_period_until: user.grace_period_until || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    plan: planDetails,
    subscription_type
  };
}

/**
 * Get user's subscription status from User model
 */
export async function getUserSubscriptionStatus(userId: string | Types.ObjectId) {
  const user = await User.findById(userId).populate('plan_id');

  if (!user || !user.subscription_status || user.subscription_status === 'expired') {
    return {
      subscriptionStatus: 'none' as const,
      isFreeTrial: false,
      hasActiveSubscription: false,
    };
  }

  return {
    subscriptionStatus: user.subscription_status as 'active' | 'trial',
    isFreeTrial: user.subscription_status === 'trial',
    hasActiveSubscription: user.subscription_status === 'active' || user.subscription_status === 'trial',
    plan: user.plan_id,
  };
}

/**
 * Check if user can download models
 */
export async function canUserDownloadModels(userId: string | Types.ObjectId) {
  const { hasActiveSubscription } = await getUserSubscriptionStatus(userId);
  return hasActiveSubscription;
}

/**
 * Get complete user profile with subscription details
 */
export async function getUserProfile(userId: string | Types.ObjectId): Promise<any> {
  const user = await User.findById(userId).populate('plan_id');
  if (!user) return null;

  const subscriptionData = await getUserSubscriptionStatus(userId);

  return {
    ...user.toJSON(),
    ...subscriptionData,
  };
}
