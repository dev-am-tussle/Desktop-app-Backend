import { User } from '../models';
import { Types } from 'mongoose';

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
export async function getUserProfile(userId: string | Types.ObjectId) {
  const user = await User.findById(userId).populate('plan_id');
  if (!user) return null;

  const subscriptionData = await getUserSubscriptionStatus(userId);

  return {
    ...user.toJSON(),
    ...subscriptionData,
  };
}
