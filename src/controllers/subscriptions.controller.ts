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
import { SubscriptionPlan, User, CouponRedemption } from '../models';
import { AppError } from '../middleware/errorHandler';
import * as stripeService from '../utils/stripe';
import { formatPlanPricing } from '../utils/formatters';
import PlanEntitlement from '../models/PlanEntitlement.model';
import EntitlementDefinition from '../models/EntitlementDefinition.model';

// ============================================
// SUBSCRIPTION PLAN CONTROLLERS
// ============================================

/**
 * Get All Subscription Plans
 * Returns plans with entitlements and localized pricing (multi-currency)
 * 
 * Optional Query Parameters:
 * - status: 'active' | 'archived'
 * - category: 'personal' | 'business' | 'enterprise'
 * - currency: Override currency detection (e.g., 'USD', 'INR')
 * 
 * Response includes:
 * - Full plan details
 * - Localized prices based on detected region (or requested currency)
 * - Entitlements grouped by category
 * - Pricing source tracking (base/manual/auto_converted)
 */
export const getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, currency: requestedCurrency } = req.query;
    
    // Get user's currency from region detection middleware, or use requested currency
    const userRegion = (req as any).user_region || {};
    const userCurrency = (requestedCurrency as string) || userRegion.currency || 'AUD';

    const filter: any = {};
    
    // Return all plans without any status filtering unless explicitly requested
    if (status) {
      filter.status = status;
    }
    
    if (category) filter.category = category;

    // Fetch user's current plan if logged in
    let currentUserPlanId = null;
    if (req.user?.userId) {
      const user = await User.findById(req.user.userId).select('plan_id');
      currentUserPlanId = user?.plan_id?.toString();
    }

    const plans = await SubscriptionPlan.find(filter);

    // Sort in memory by sort_order
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

        // Extract localized pricing for requested currency
        const monthlyPrice = plan.prices?.monthly?.[userCurrency];
        const yearlyPrice = plan.prices?.yearly?.[userCurrency];

        // Build localized pricing response
        const localizedPricing = {
          currency: userCurrency,
          monthly: monthlyPrice ? {
            amount: monthlyPrice.amount / 100, // Convert cents to real units
            prev_amount: monthlyPrice.prev_amount ? monthlyPrice.prev_amount / 100 : null,
            source: monthlyPrice.source,
          } : null,
          yearly: yearlyPrice ? {
            amount: yearlyPrice.amount / 100, // Convert cents to real units
            prev_amount: yearlyPrice.prev_amount ? yearlyPrice.prev_amount / 100 : null,
            source: yearlyPrice.source,
          } : null,
          region_code: userRegion.country_code,
          all_available_currencies: Object.keys(plan.prices?.monthly || {}),
        };

        const formattedPlan = formatPlanPricing(plan);

        return {
          ...formattedPlan,
          isCurrentPlan: plan._id.toString() === currentUserPlanId,
          pricing: localizedPricing,
          entitlements: groupedEntitlements,
          entitlements_count: planEntitlements.length,
        };
      })
    );

    res.json({
      data: plansWithEntitlements,
      meta: {
        detected_currency: userCurrency,
        detected_region: userRegion.country_code,
        total_plans: plansWithEntitlements.length,
      },
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

    res.json({ data: formatPlanPricing(plan) });
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
      display_name,
      slug,
      description,
      features,
      category,
      price_monthly,
      price_yearly,
      currency,
      is_contact_sales,
      status,
      sort_order,
    } = req.body;

    // STEP 1: Create Stripe Product
    console.log('🔵 Creating Stripe Product...');
    const stripeProduct = await stripeService.createStripeProduct({
      name: display_name || name,
      description,
    });
    console.log('✅ Stripe Product Created:', stripeProduct.id);

    // STEP 2: Create Stripe Prices
    let stripePriceMonthlyId = null;
    let stripePriceYearlyId = null;

    if (price_monthly > 0) {
      console.log('🔵 Creating Monthly Stripe Price...');
      const monthlyPrice = await stripeService.createStripePrice({
        productId: stripeProduct.id,
        amount: price_monthly,
        currency: currency || 'AUD',
        billingPeriod: 'monthly',
      });
      stripePriceMonthlyId = monthlyPrice.id;
      console.log('✅ Monthly Stripe Price Created:', stripePriceMonthlyId);
    }

    if (price_yearly && price_yearly > 0) {
      console.log('🔵 Creating Yearly Stripe Price...');
      const yearlyPrice = await stripeService.createStripePrice({
        productId: stripeProduct.id,
        amount: price_yearly,
        currency: currency || 'AUD',
        billingPeriod: 'yearly',
      });
      stripePriceYearlyId = yearlyPrice.id;
      console.log('✅ Yearly Stripe Price Created:', stripePriceYearlyId);
    }

    // STEP 3: Save Plan in Database with Stripe IDs
    const plan = await SubscriptionPlan.create({
      name,
      display_name: display_name || name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      description,
      features: features || [],
      category: category || 'personal',
      price_monthly: price_monthly || 0,
      price_yearly: price_yearly || 0,
      currency: currency || 'AUD',
      is_contact_sales: is_contact_sales || false,
      status: status || 'active',
      sort_order: sort_order || 1,
      stripe_product_id: stripeProduct.id,
      stripe_price_monthly_id: stripePriceMonthlyId,
      stripe_price_yearly_id: stripePriceYearlyId,
    });

    res.status(201).json({
      data: formatPlanPricing(plan),
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

    // Handle monthly price updates
    if (updates.price_monthly !== undefined && updates.price_monthly !== plan.price_monthly) {
      console.log('🔵 Monthly price changed - Creating new Stripe Price...');

      // Archive old monthly price
      if (plan.stripe_price_monthly_id) {
        await stripeService.archiveStripePrice(plan.stripe_price_monthly_id);
      }

      // Create new monthly price if > 0
      if (updates.price_monthly > 0) {
        const newMonthlyPrice = await stripeService.createStripePrice({
          productId: plan.stripe_product_id!,
          amount: updates.price_monthly,
          currency: updates.currency || plan.currency,
          billingPeriod: 'monthly',
        });
        updates.stripe_price_monthly_id = newMonthlyPrice.id;
        console.log('✅ New Monthly Stripe Price Created:', newMonthlyPrice.id);
      } else {
        updates.stripe_price_monthly_id = null;
      }
    }

    // Handle yearly price updates
    if (updates.price_yearly !== undefined && updates.price_yearly !== plan.price_yearly) {
      console.log('🔵 Yearly price changed - Creating new Stripe Price...');

      // Archive old yearly price
      if (plan.stripe_price_yearly_id) {
        await stripeService.archiveStripePrice(plan.stripe_price_yearly_id);
      }

      // Create new yearly price if > 0
      if (updates.price_yearly > 0) {
        const newYearlyPrice = await stripeService.createStripePrice({
          productId: plan.stripe_product_id!,
          amount: updates.price_yearly,
          currency: updates.currency || plan.currency,
          billingPeriod: 'yearly',
        });
        updates.stripe_price_yearly_id = newYearlyPrice.id;
        console.log('✅ New Yearly Stripe Price Created:', newYearlyPrice.id);
      } else {
        updates.stripe_price_yearly_id = null;
      }
    }

    // Update Stripe Product if name/description changed
    if ((updates.display_name || updates.description) && plan.stripe_product_id) {
      await stripeService.updateStripeProduct(plan.stripe_product_id, {
        name: updates.display_name,
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
      data: formatPlanPricing(updatedPlan),
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
    if (plan.stripe_product_id) {
      await stripeService.archiveStripeProduct(plan.stripe_product_id);
    }
    
    // Handle legacy fields
    if (plan.stripe_price_monthly_id) {
      await stripeService.archiveStripePrice(plan.stripe_price_monthly_id);
    }
    if (plan.stripe_price_yearly_id) {
      await stripeService.archiveStripePrice(plan.stripe_price_yearly_id);
    }

    // Handle new multi-currency prices object
    if (plan.prices) {
      // Monthly prices
      if (plan.prices.monthly) {
        for (const currency of Object.keys(plan.prices.monthly)) {
          const priceId = plan.prices.monthly[currency].stripe_price_id;
          if (priceId) {
            console.log(`🔵 Archiving Monthly Stripe Price for ${currency}: ${priceId}`);
            await stripeService.archiveStripePrice(priceId);
          }
        }
      }
      // Yearly prices
      if (plan.prices.yearly) {
        for (const currency of Object.keys(plan.prices.yearly)) {
          const priceId = plan.prices.yearly[currency].stripe_price_id;
          if (priceId) {
            console.log(`🔵 Archiving Yearly Stripe Price for ${currency}: ${priceId}`);
            await stripeService.archiveStripePrice(priceId);
          }
        }
      }
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

    // 1. Reactivate in Stripe
    if (plan.stripe_product_id) {
      console.log(`🔵 Reactivating Stripe Product: ${plan.stripe_product_id}`);
      await stripeService.reactivateStripeProduct(plan.stripe_product_id);
    }

    // Handle legacy fields
    if (plan.stripe_price_monthly_id) {
      await stripeService.reactivateStripePrice(plan.stripe_price_monthly_id);
    }
    if (plan.stripe_price_yearly_id) {
      await stripeService.reactivateStripePrice(plan.stripe_price_yearly_id);
    }

    // Handle new multi-currency prices object
    if (plan.prices) {
      // Monthly prices
      if (plan.prices.monthly) {
        for (const currency of Object.keys(plan.prices.monthly)) {
          const priceId = plan.prices.monthly[currency].stripe_price_id;
          if (priceId) {
            console.log(`🔵 Reactivating Monthly Stripe Price for ${currency}: ${priceId}`);
            await stripeService.reactivateStripePrice(priceId);
          }
        }
      }
      // Yearly prices
      if (plan.prices.yearly) {
        for (const currency of Object.keys(plan.prices.yearly)) {
          const priceId = plan.prices.yearly[currency].stripe_price_id;
          if (priceId) {
            console.log(`🔵 Reactivating Yearly Stripe Price for ${currency}: ${priceId}`);
            await stripeService.reactivateStripePrice(priceId);
          }
        }
      }
    }

    // 2. Reactivate plan in database
    plan.status = 'active';
    await plan.save();

    res.json({
      data: {
        message: 'Subscription plan unarchived successfully',
        plan: formatPlanPricing(plan),
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
    const activeUsers = await User.countDocuments({
      plan_id: id,
      subscription_status: { $in: ['active', 'trial'] },
    });

    if (activeUsers > 0) {
      throw new AppError(
        `Cannot delete plan. ${activeUsers} active user(s) are using this plan. Archive it instead.`,
        400,
        'PLAN_IN_USE'
      );
    }

    // Archive Stripe resources
    if (plan.stripe_product_id) {
      await stripeService.archiveStripeProduct(plan.stripe_product_id);
    }
    
    // Handle legacy fields
    if (plan.stripe_price_monthly_id) {
      await stripeService.archiveStripePrice(plan.stripe_price_monthly_id);
    }
    if (plan.stripe_price_yearly_id) {
      await stripeService.archiveStripePrice(plan.stripe_price_yearly_id);
    }

    // Handle new multi-currency prices object
    if (plan.prices) {
      // Monthly prices
      if (plan.prices.monthly) {
        for (const currency of Object.keys(plan.prices.monthly)) {
          const priceId = plan.prices.monthly[currency].stripe_price_id;
          if (priceId) {
            console.log(`🔵 Archiving Monthly Stripe Price for ${currency}: ${priceId}`);
            await stripeService.archiveStripePrice(priceId);
          }
        }
      }
      // Yearly prices
      if (plan.prices.yearly) {
        for (const currency of Object.keys(plan.prices.yearly)) {
          const priceId = plan.prices.yearly[currency].stripe_price_id;
          if (priceId) {
            console.log(`🔵 Archiving Yearly Stripe Price for ${currency}: ${priceId}`);
            await stripeService.archiveStripePrice(priceId);
          }
        }
      }
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
        .select('name email plan_id subscription_status subscription_ends_at createdAt stripeSubscriptionId')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((user: any) => user._id);
    const couponRedemptions = await CouponRedemption.find({
      user_id: { $in: userIds },
    }).select('user_id').lean();

    const couponUserIds = new Set(couponRedemptions.map((cr: any) => cr.user_id.toString()));

    // Transform to match old subscription response format for frontend compatibility
    const subscriptions = users.map((user: any) => {
      let access_type = 'free';

      if (user.stripeSubscriptionId) {
        access_type = 'stripe';
      } else if (couponUserIds.has(user._id.toString())) {
        access_type = 'coupon';
      } else if (user.subscription_status === 'trial') {
        access_type = 'trial';
      }

      return {
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
        } : null,
        status: user.subscription_status || 'expired',
        nextBillingDate: user.subscription_ends_at,
        createdAt: user.createdAt,
        access_type,
      };
    });

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

