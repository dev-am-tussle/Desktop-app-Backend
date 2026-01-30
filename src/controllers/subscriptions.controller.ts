// @ts-nocheck
// ============================================
// ⚠️ DEPRECATED CONTROLLER - USE ENTITLEMENTS SYSTEM INSTEAD
// ============================================
// This controller is kept for backward compatibility with admin panel.
// New implementations should use the entitlements system:
// - User.plan_id instead of Subscription.planId
// - User.subscription_status instead of Subscription.status
// - EntitlementCache for feature access control
// ============================================
import { Request, Response, NextFunction } from 'express';
import { SubscriptionPlan, User } from '../models';
import { AppError } from '../middleware/errorHandler';
import * as stripeService from '../utils/stripe';
import PlanEntitlement from '../models/PlanEntitlement.model';
import EntitlementDefinition from '../models/EntitlementDefinition.model';

// ============================================
// SUBSCRIPTION PLAN CONTROLLERS
// ============================================

/**
 * Get All Subscription Plans
 * Returns plans with entitlements grouped by category
 */
export const getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;

    const filter: any = {};
    if (status) filter.status = status;

    const plans = await SubscriptionPlan.find(filter);

    // Sort in memory by sort_order (Azure Cosmos DB doesn't have index on this field)
    plans.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Fetch entitlements for all plans
    const plansWithEntitlements = await Promise.all(
      plans.map(async (plan) => {
        // Get plan entitlements
        const planEntitlements = await PlanEntitlement.find({ plan_id: plan._id }).lean();

        // Get entitlement definitions for metadata
        const entitlementKeys = planEntitlements.map((e: any) => e.entitlement_key);
        const definitions = await EntitlementDefinition.find({
          key: { $in: entitlementKeys },
        }).lean();

        // Create a map of key -> definition
        const definitionMap = new Map(definitions.map((d: any) => [d.key, d]));

        // Group entitlements by category
        const groupedEntitlements: any = {
          capabilities: [],
          limits: [],
          resources: [],
          deployment: [],
          support: [],
        };

        planEntitlements.forEach((ent: any) => {
          const def = definitionMap.get(ent.entitlement_key);
          if (def) {
            groupedEntitlements[def.category].push({
              key: ent.entitlement_key,
              value: ent.value,
              type: def.type,
              description: def.description,
            });
          }
        });

        return {
          ...plan.toJSON(),
          entitlements: groupedEntitlements,
          entitlements_count: planEntitlements.length,
        };
      })
    );

    res.json({
      data: plansWithEntitlements,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Subscription Plan by ID
 */
export const getSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    res.json({ data: plan });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Subscription Plan
 * Admin creates plan → Backend creates Stripe Product + Price
 */
export const createSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      description,
      price,
      currency,
      billingPeriod,
      seats,
      features,
      maxModels,
      offlineModelSizeLimit,
      status,
    } = req.body;

    // STEP 1: Create Stripe Product
    console.log('🔵 Creating Stripe Product...');
    const stripeProduct = await stripeService.createStripeProduct({
      name,
      description,
    });
    console.log('✅ Stripe Product Created:', stripeProduct.id);

    // STEP 2: Create Stripe Price
    console.log('🔵 Creating Stripe Price...');
    const stripePrice = await stripeService.createStripePrice({
      productId: stripeProduct.id,
      amount: price,
      currency: currency || 'USD',
      billingPeriod,
    });
    console.log('✅ Stripe Price Created:', stripePrice.id);

    // STEP 3: Save Plan in Database with Stripe IDs
    const plan = await SubscriptionPlan.create({
      name,
      description,
      price,
      currency: currency || 'USD',
      billingPeriod,
      seats: seats || 1,
      features: features || [],
      maxModels,
      offlineModelSizeLimit,
      status: status || 'active',
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id,
    });

    res.status(201).json({
      data: plan,
      message: 'Subscription plan created with Stripe integration',
    });
  } catch (error: any) {
    console.error('❌ Plan Creation Failed:', error);
    next(new AppError(error.message, 500, 'STRIPE_ERROR'));
  }
};

/**
 * Update Subscription Plan
 * Handle price changes by creating new Stripe Price
 */
export const updateSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // If price is being updated, create new Stripe Price (prices are immutable)
    if (updates.price && updates.price !== plan.price) {
      console.log('🔵 Price changed - Creating new Stripe Price...');

      // Archive old price
      if (plan.stripePriceId) {
        await stripeService.archiveStripePrice(plan.stripePriceId);
      }

      // Create new price
      const newStripePrice = await stripeService.createStripePrice({
        productId: plan.stripeProductId!,
        amount: updates.price,
        currency: updates.currency || plan.currency,
        billingPeriod: updates.billingPeriod || plan.billingPeriod,
      });

      updates.stripePriceId = newStripePrice.id;
      console.log('✅ New Stripe Price Created:', newStripePrice.id);
    }

    // Update Stripe Product if name/description changed
    if ((updates.name || updates.description) && plan.stripeProductId) {
      await stripeService.updateStripeProduct(plan.stripeProductId, {
        name: updates.name,
        description: updates.description,
      });
    }

    // Update plan in database
    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      data: updatedPlan,
      message: 'Plan updated successfully',
    });
  } catch (error: any) {
    console.error('❌ Plan Update Failed:', error);
    next(new AppError(error.message, 500, 'UPDATE_ERROR'));
  }
};

/**
 * Archive Subscription Plan
 * Also archives Stripe Product and Price
 */
export const archiveSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    if (plan.status === 'archived') {
      throw new AppError('Plan is already archived', 400, 'ALREADY_ARCHIVED');
    }

    // Archive Stripe resources
    if (plan.stripeProductId) {
      await stripeService.archiveStripeProduct(plan.stripeProductId);
    }
    if (plan.stripePriceId) {
      await stripeService.archiveStripePrice(plan.stripePriceId);
    }

    // Archive plan in database
    plan.status = 'archived';
    await plan.save();

    res.json({
      data: {
        message: 'Subscription plan archived successfully',
        plan,
      },
    });
  } catch (error: any) {
    console.error('❌ Plan Archive Failed:', error);
    next(new AppError(error.message, error.statusCode || 500, error.code || 'ARCHIVE_ERROR'));
  }
};

/**
 * Unarchive Subscription Plan
 * Reactivates an archived plan
 */
export const unarchiveSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    if (plan.status !== 'archived') {
      throw new AppError('Plan is not archived', 400, 'NOT_ARCHIVED');
    }

    // Reactivate plan in database
    plan.status = 'active';
    await plan.save();

    res.json({
      data: {
        message: 'Subscription plan unarchived successfully',
        plan,
      },
    });
  } catch (error: any) {
    console.error('❌ Plan Unarchive Failed:', error);
    next(new AppError(error.message, error.statusCode || 500, error.code || 'UNARCHIVE_ERROR'));
  }
};

/**
 * Delete Subscription Plan from mongodb
 * Only allowed if no active subscriptions use this plan
 * Also archives Stripe Product and Price
 */
export const deleteSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Check if any active subscriptions use this plan
    const activeSubscriptions = await Subscription.countDocuments({
      planId: id,
      status: { $in: ['active', 'trial'] },
    });

    if (activeSubscriptions > 0) {
      throw new AppError(
        `Cannot delete plan. ${activeSubscriptions} active subscription(s) are using this plan. Archive it instead.`,
        400,
        'PLAN_IN_USE'
      );
    }

    // Archive Stripe resources
    if (plan.stripeProductId) {
      await stripeService.archiveStripeProduct(plan.stripeProductId);
    }
    if (plan.stripePriceId) {
      await stripeService.archiveStripePrice(plan.stripePriceId);
    }

    // Delete plan from database
    await SubscriptionPlan.findByIdAndDelete(id);

    res.json({
      data: {
        message: 'Subscription plan deleted successfully',
        planId: id,
      },
    });
  } catch (error: any) {
    console.error('❌ Plan Delete Failed:', error);
    next(new AppError(error.message, error.statusCode || 500, error.code || 'DELETE_ERROR'));
  }
};

// ============================================
// SUBSCRIPTION CONTROLLERS
// ============================================

/**
 * Get All Subscriptions
 * ⚠️ MIGRATED: Returns user subscription data from User model
 */
export const getSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;

    // Build filter for User model
    const filter: any = {};
    if (status) {
      filter.subscription_status = status; // Map to new field
    }
    if (userId) {
      filter._id = userId;
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Query users with their plan data
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('plan_id', 'name display_name slug price_monthly price_yearly')
        .select('name email plan_id subscription_status subscription_ends_at createdAt')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    // Transform to match old subscription response format for frontend compatibility
    const subscriptions = users.map((user: any) => ({
      _id: user._id,
      userId: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      planId: user.plan_id ? {
        _id: user.plan_id._id,
        name: user.plan_id.display_name || user.plan_id.name,
        price: user.plan_id.price_monthly || 0,
        currency: 'USD',
      } : null,
      status: user.subscription_status || 'expired',
      nextBillingDate: user.subscription_ends_at,
      createdAt: user.createdAt,
    }));

    res.json({
      data: subscriptions,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Subscription by ID
 * ⚠️ MIGRATED: Returns user data with subscription info
 */
export const getSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .populate('plan_id')
      .select('name email avatar plan_id subscription_status subscription_ends_at createdAt');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Transform to old subscription format
    const subscription = {
      _id: user._id,
      userId: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      planId: user.plan_id,
      status: user.subscription_status || 'expired',
      nextBillingDate: user.subscription_ends_at,
      createdAt: user.createdAt,
    };

    res.json({ data: subscription });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel Subscription
 * ⚠️ MIGRATED: Updates User.subscription_status to cancelled
 */
export const cancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { subscription_status: 'cancelled' } },
      { new: true }
    ).populate('plan_id');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Invalidate entitlement cache
    const { EntitlementCache } = require('../models');
    await EntitlementCache.updateMany(
      { user_id: id },
      { $set: { revoked: true } }
    );

    res.json({
      data: {
        message: 'Subscription cancelled successfully',
        subscription: {
          _id: user._id,
          userId: { _id: user._id, name: user.name, email: user.email },
          planId: user.plan_id,
          status: user.subscription_status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause Subscription
 * ⚠️ MIGRATED: Updates User.subscription_status to past_due
 */
export const pauseSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { subscription_status: 'past_due' } },
      { new: true }
    ).populate('plan_id');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      data: {
        message: 'Subscription paused successfully',
        subscription: {
          _id: user._id,
          userId: { _id: user._id, name: user.name, email: user.email },
          planId: user.plan_id,
          status: user.subscription_status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume Subscription
 * ⚠️ MIGRATED: Updates User.subscription_status to active
 */
export const resumeSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { subscription_status: 'active' } },
      { new: true }
    ).populate('plan_id');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Invalidate cache to force fresh entitlement generation
    const { EntitlementCache } = require('../models');
    await EntitlementCache.updateMany(
      { user_id: id },
      { $set: { revoked: true } }
    );

    res.json({
      data: {
        message: 'Subscription resumed successfully',
        subscription: {
          _id: user._id,
          userId: { _id: user._id, name: user.name, email: user.email },
          planId: user.plan_id,
          status: user.subscription_status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Select Plan for User's Subscription
 * Desktop app calls this after user selects a plan
 * This only saves the plan selection, does NOT activate
 * User must complete payment to activate
 */
export const selectPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // Verify plan exists
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    if (plan.status !== 'active') {
      throw new AppError('This plan is not available', 400, 'PLAN_INACTIVE');
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Update user's plan selection (status will change after payment)
    user.plan_id = planId as any;
    await user.save();

    // Update user onboarding phase
    await User.findByIdAndUpdate(userId, {
      $set: {
        onboardingPhase: 'plan_selection',
        'phaseCompletedAt.planSelection': new Date(),
      },
    });

    // Populate plan details for response
    await user.populate('plan_id');

    res.json({
      data: {
        message: 'Plan selected successfully',
        subscription: {
          _id: user._id,
          userId: { _id: user._id, name: user.name, email: user.email },
          planId: user.plan_id,
          status: user.subscription_status,
        },
        plan,
        nextStep: (plan.price_monthly > 0 || plan.price_yearly > 0) ? 'payment_required' : 'activate_free_plan',
        paymentRequired: (plan.price_monthly > 0 || plan.price_yearly > 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

