import { User, Subscription } from '../models';
import { Types } from 'mongoose';

/**
 * Get user's subscription status from Subscription collection
 */
export async function getUserSubscriptionStatus(userId: string | Types.ObjectId) {
  const subscription = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'trial'] },
  }).populate('planId');

  if (!subscription) {
    return {
      subscriptionStatus: 'none' as const,
      isFreeTrial: false,
      hasActiveSubscription: false,
    };
  }

  return {
    subscriptionStatus: subscription.status as 'active' | 'trial',
    isFreeTrial: subscription.status === 'trial',
    hasActiveSubscription: true,
    subscription,
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
  const user = await User.findById(userId);
  if (!user) return null;

  const subscriptionData = await getUserSubscriptionStatus(userId);

  return {
    ...user.toJSON(),
    ...subscriptionData,
  };
}
