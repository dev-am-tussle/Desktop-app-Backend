import { Request, Response, NextFunction } from 'express';
import { SubscriptionPlan, Subscription, User } from '../models';
import { AppError } from '../middleware/errorHandler';
import * as stripeService from '../utils/stripe';

// ============================================
// SUBSCRIPTION PLAN CONTROLLERS
// ============================================

/**
 * Get All Subscription Plans
 */
export const getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;

    const filter: any = {};
    if (status) filter.status = status;

    const plans = await SubscriptionPlan.find(filter).sort({ _id: -1 });

    res.json({
      data: plans,
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
 * Delete (Archive) Subscription Plan
 * Also archives Stripe Product and Price
 */
export const deleteSubscriptionPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
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
    next(new AppError(error.message, 500, 'ARCHIVE_ERROR'));
  }
};

// ============================================
// SUBSCRIPTION CONTROLLERS
// ============================================

/**
 * Get All Subscriptions
 */
export const getSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const skip = (Number(page) - 1) * Number(limit);

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('userId', 'name email')
        .populate('planId', 'name price currency')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Subscription.countDocuments(filter),
    ]);

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
 */
export const getSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findById(id)
      .populate('userId', 'name email avatar')
      .populate('planId');

    if (!subscription) {
      throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    res.json({ data: subscription });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel Subscription
 */
export const cancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findByIdAndUpdate(
      id,
      { $set: { status: 'cancelled' } },
      { new: true }
    );

    if (!subscription) {
      throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    res.json({
      data: {
        message: 'Subscription cancelled successfully',
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause Subscription
 */
export const pauseSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findByIdAndUpdate(
      id,
      { $set: { status: 'paused' } },
      { new: true }
    );

    if (!subscription) {
      throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    res.json({
      data: {
        message: 'Subscription paused successfully',
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume Subscription
 */
export const resumeSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findByIdAndUpdate(
      id,
      { $set: { status: 'active' } },
      { new: true }
    );

    if (!subscription) {
      throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    res.json({
      data: {
        message: 'Subscription resumed successfully',
        subscription,
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

    // Find user's active subscription (trial or active)
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['trial', 'active'] },
    });

    if (!subscription) {
      throw new AppError('No active subscription found', 404, 'NO_SUBSCRIPTION');
    }

    // Only update planId, don't change status yet
    // Status will change after payment completion
    subscription.planId = planId as any;
    await subscription.save();

    // Update user onboarding phase
    await User.findByIdAndUpdate(userId, {
      $set: {
        onboardingPhase: 'plan_selection',
        'phaseCompletedAt.planSelection': new Date(),
      },
    });

    // Populate plan details for response
    await subscription.populate('planId');

    res.json({
      data: {
        message: 'Plan selected successfully',
        subscription,
        plan,
        nextStep: plan.price > 0 ? 'payment_required' : 'activate_free_plan',
        paymentRequired: plan.price > 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
