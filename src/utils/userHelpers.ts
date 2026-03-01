import { User, CouponRedemption, Payment } from '../models';
import { Types } from 'mongoose';

/**
 * Get detailed subscription information for a user in standard architecture
 */
export async function getSubscriptionDetails(userData: any) {
  // Ensure we have a Mongoose object if it's just an ID or partial
  let user = userData;
  // If user is an id, or plan_id is not populated (no name field), populate plan_id and load full user
  const needLoad = !user || !user.subscription_status || !user.plan_id || !user.plan_id?.name;
  if (needLoad) {
    user = await User.findById(userData._id || userData).populate('plan_id').lean();
  }

  if (!user) return null;

  // 1. Build Plan Summary (Compact)
  let planSummary = null;
  if (user.plan_id) {
    const plan = user.plan_id.toJSON ? user.plan_id.toJSON() : user.plan_id;
    planSummary = {
      id: plan._id || plan.id,
      name: plan.name || plan.display_name || null,
      display_name: plan.display_name || plan.name || null,
      slug: plan.slug || null,
      description: plan.description || null,
      stripe_product_id: plan.stripe_product_id || null,
      status: plan.status || null,
      category: plan.category || 'personal',
      features: plan.features || []
    };
  }

  // Handle coupon-based subscription
  if (user.subscription_status === 'active' && !user.stripeSubscriptionId) {
    const lastRedemption = await CouponRedemption.findOne({ user_id: user._id })
      .populate('coupon_id')
      .sort({ redeemed_at: -1 });
      
    if (lastRedemption) {
      const coupon = lastRedemption.coupon_id as any;
      
      // Only override if it was a custom type coupon (no plan_id associated)
      if (coupon && coupon.type === 'custom') {
        planSummary = {
          id: coupon._id || lastRedemption.coupon_id,
          name: 'custom',
          display_name: 'Custom Individual Plan',
          slug: 'custom-individual-plan',
          description: 'Custom attributes granted via coupon',
          category: 'personal',
          features: []
        };
      }
      // For type === 'plan', we keep planSummary as it was built from user.plan_id
    }
  }

  // 2. Fetch Recent Payment (Only for paid plans, free users get null)
  let recentPayment = null;
  const isFreePlan = !planSummary || planSummary.slug === 'free' || planSummary.name?.toLowerCase() === 'free';
  
  if (!isFreePlan) {
    try {
      // Only consider paid transactions (amount > 0) as recentPayment. 
      const payment = await Payment.findOne({ userId: user._id, amount: { $gt: 0 } })
        .sort({ date: -1 })
        .lean();

      if (payment) {
        recentPayment = {
          id: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          transactionId: payment.transactionId || null,
          date: payment.date
        };
      }
    } catch (err) {
      console.warn('⚠️ Shared helper: Failed to fetch recent payment:', err);
    }
  }

  // 3. Resolve Entitlements (Using EntitlementsService to handle plan + overrides + coupons)
  let groupedEntitlements: any = {
    capabilities: {},
    limits: {},
    resources: {},
    deployment: {},
    support: {},
  };

  try {
    const { default: entitlementsService } = await import('../services/entitlements.service');
    const fullSnapshot = await entitlementsService.resolveUserEntitlements(user._id);
    if (fullSnapshot && fullSnapshot.entitlements) {
      groupedEntitlements = fullSnapshot.entitlements;
    }
  } catch (err) {
    console.warn('⚠️ Shared helper: Failed to fetch entitlements via service:', err);
  }

  return {
    active: ['active', 'trial'].includes(user.subscription_status),
    subscriptionStatus: user.subscription_status || 'none',
    plan: planSummary,
    recentPayment,
    entitlements: groupedEntitlements,
    validUntil: user.subscription_ends_at || null,
    stripeCustomerId: user.stripeCustomerId || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      status: user.status,
      onboardingPhase: user.onboardingPhase || 'account_created',
      tags: user.tags || []
    }
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
