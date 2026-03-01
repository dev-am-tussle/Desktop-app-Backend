// @ts-nocheck
// ============================================
// ⚠️ LEGACY CONTROLLER - Migrated to User model
// ============================================
// This controller now uses User.plan_id instead of Subscription collection.
// Desktop app should use the new entitlements system.
// ============================================
import { Request, Response, NextFunction } from 'express';
import { Payment, User, SubscriptionPlan, PaymentSession } from '../models';
import { AppError } from '../middleware/errorHandler';
import * as stripeService from '../utils/stripe';
import { getSubscriptionDetails } from '../utils/userHelpers';

// ============================================
// HELPERS
// ============================================

/**
 * Helper to convert plan pricing from cents to real units for API response
 */
const formatPlanPricing = (plan: any) => {
  if (!plan) return null;
  const planData = plan.toJSON ? plan.toJSON() : plan;

  // Convert localized prices
  if (planData.prices) {
    if (planData.prices.monthly) {
      Object.keys(planData.prices.monthly).forEach(curr => {
        if (planData.prices.monthly[curr]) {
          planData.prices.monthly[curr].amount /= 100;
        }
      });
    }
    if (planData.prices.yearly) {
      Object.keys(planData.prices.yearly).forEach(curr => {
        if (planData.prices.yearly[curr]) {
          planData.prices.yearly[curr].amount /= 100;
        }
      });
    }
  }

  // Convert metadata base amounts
  if (planData.pricing_metadata) {
    if (planData.pricing_metadata.base_amount_monthly) {
      planData.pricing_metadata.base_amount_monthly /= 100;
    }
    if (planData.pricing_metadata.base_amount_yearly) {
      planData.pricing_metadata.base_amount_yearly /= 100;
    }
  }

  // Convert legacy fields
  if (planData.price_monthly) planData.price_monthly /= 100;
  if (planData.price_yearly) planData.price_yearly /= 100;

  return planData;
};

/**
 * Get All Payments
 */
export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, perPage = 20, status, userId } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const skip = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('userId', 'name email')
        .populate('planId', 'name display_name price_monthly price_yearly currency')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    res.json({
      data: payments,
      meta: {
        page: Number(page),
        perPage: Number(perPage),
        total,
        totalPages: Math.ceil(total / Number(perPage)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Payment by ID
 */
export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('userId', 'name email avatar')
      .populate('planId', 'name display_name price_monthly price_yearly currency');

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    res.json({ data: payment });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Payment
 */
export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, planId, amount, currency, method, status, transactionId } = req.body;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify plan exists
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    const payment = await Payment.create({
      userId,
      planId,
      amount,
      currency,
      method,
      status: status || 'pending',
      transactionId,
    });

    const populatedPayment = await Payment.findById(payment._id)
      .populate('userId', 'name email')
      .populate('planId', 'name price currency');

    res.status(201).json({
      data: populatedPayment,
      message: 'Payment created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Payment
 */
export const updatePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const payment = await Payment.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('userId', 'name email')
      .populate('planId', 'name price currency');

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    res.json({
      data: payment,
      message: 'Payment updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refund Payment
 */
export const refundPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status !== 'completed') {
      throw new AppError('Only completed payments can be refunded', 400, 'INVALID_PAYMENT_STATUS');
    }

    payment.status = 'refunded';
    if (reason) {
      payment.metadata = { ...payment.metadata, refundReason: reason };
    }
    await payment.save();

    res.json({
      data: payment,
      message: 'Payment refunded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Payment
 */
export const deletePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByIdAndDelete(id);
    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    res.json({
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// STRIPE CHECKOUT SESSION ENDPOINT
// ============================================

/**
 * Create Stripe Checkout Session
 * POST /api/payments/checkout-session
 * 
 * PAYLOAD EXPECTED:
 * {
 *   "planId": "...",        // MongoDB Plan ID
 *   "billingCycle": "...",   // "monthly" or "yearly"
 *   "currency": "..."       // "USD", "INR", "AUD", etc.
 * }
 */
export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, billingCycle, currency } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    if (!planId || !billingCycle || !currency) {
      throw new AppError('Missing required fields: planId, billingCycle, currency', 400, 'MISSING_FIELDS');
    }

    // Fetch user and plan
    const [user, plan] = await Promise.all([
      User.findById(userId),
      SubscriptionPlan.findById(planId),
    ]);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    if (plan.status !== 'active') {
      throw new AppError('This plan is not available', 400, 'PLAN_INACTIVE');
    }

    // Determine the Price ID from multi-currency structure
    const billingPeriod = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const priceData = plan.prices?.[billingPeriod]?.[currency.toUpperCase()];

    if (!priceData) {
      throw new AppError(
        `Plan not available for ${currency} ${billingPeriod} payments`,
        400,
        'CURRENCY_NOT_SUPPORTED'
      );
    }

    const { amount, stripe_price_id: stripePriceId } = priceData;

    if (!stripePriceId) {
      throw new AppError(
        `Plan not configured for Stripe ${billingPeriod} payments in ${currency}`,
        400,
        'STRIPE_NOT_CONFIGURED'
      );
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      console.log('🔵 Creating Stripe Customer...');
      const stripeCustomer = await stripeService.createStripeCustomer({
        email: user.email,
        name: user.name,
        userId: userId.toString(),
      });

      stripeCustomerId = stripeCustomer.id;

      // Save Stripe customer ID to user
      user.stripeCustomerId = stripeCustomerId;
      await user.save();

      console.log('✅ Stripe Customer Created:', stripeCustomerId);
    }

    // Create Stripe Checkout Session
    console.log('🔵 Creating Stripe Checkout Session...');
    const checkoutSession = await stripeService.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: stripePriceId,
      userId: userId.toString(),
      planId: planId.toString(),
      mode: 'subscription',
    });

    console.log('✅ Checkout Session Created:', checkoutSession.id);

    // Save payment session to database (multi-currency)
    await PaymentSession.create({
      userId,
      planId,
      stripeSessionId: checkoutSession.id,
      stripeCustomerId,
      status: 'pending',
      amount,
      currency,
      metadata: { billingCycle, billingPeriod }
    });

    res.json({
      data: {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
        message: 'Open this URL in browser to complete payment',
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error('❌ Checkout Session Creation Failed:', error);
    next(new AppError(error.message, 500, 'CHECKOUT_ERROR'));
  }
};

// ============================================
// PUBLIC PAYMENT ENDPOINTS - Desktop App
// ============================================

/**
 * Process Payment from Desktop App
 * After user completes payment, this endpoint:
 * 1. Creates payment record
 * 2. Activates user's subscription with selected plan
 * 3. Updates subscription status to 'active'
 */
export const processPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, paymentMethod, transactionId, amount, currency = 'AUD', billingCycle = 'monthly' } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // Verify plan exists
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Verify amount matches plan price for chosen currency and cycle
    const billingPeriod = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const planPriceData = plan.prices?.[billingPeriod]?.[currency.toUpperCase()];

    if (!planPriceData && amount !== 0) {
      throw new AppError(`No price configuration found for ${currency} ${billingCycle}`, 400, 'INVALID_PRICING');
    }

    const expectedAmount = planPriceData?.amount || 0;
    if (amount !== expectedAmount) {
      throw new AppError('Payment amount does not match plan price', 400, 'AMOUNT_MISMATCH');
    }

    // Create payment record
    const payment = await Payment.create({
      userId,
      planId,
      amount,
      currency: currency.toUpperCase(),
      method: paymentMethod,
      status: 'completed',
      transactionId,
      date: new Date(),
    });

    // Find user
    const user = await User.findById(userId);

    // Update user with plan and activate subscription
    user.plan_id = planId as any;
    user.subscription_status = 'active';

    // Set subscription end date based on billing period
    const subscriptionEnds = new Date();
    if (billingCycle === 'yearly') {
      subscriptionEnds.setFullYear(subscriptionEnds.getFullYear() + 1);
    } else {
      subscriptionEnds.setMonth(subscriptionEnds.getMonth() + 1);
    }
    user.subscription_ends_at = subscriptionEnds;

    await user.save();

    // Invalidate old entitlement cache
    const { EntitlementCache } = require('../models');
    await EntitlementCache.updateMany(
      { user_id: userId },
      { $set: { revoked: true } }
    );

    // Update user's onboarding phase
    await User.findByIdAndUpdate(userId, {
      $set: {
        onboardingPhase: 'payment_processing',
        'phaseCompletedAt.paymentProcessing': new Date(),
      },
    });

    // Populate plan for response
    await user.populate('plan_id');

    res.json({
      data: {
        message: 'Payment successful! Subscription activated.',
        payment: {
          id: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          transactionId: payment.transactionId,
          date: payment.date,
        },
        subscription: {
          id: user._id,
          status: user.subscription_status,
          plan: user.plan_id,
          nextBillingDate: user.subscription_ends_at,
        },
        nextStep: 'model_setup',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate Free Trial (No Payment Required)
 * For free plans, directly activate subscription
 */
export const activateFreePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // Verify plan exists and is free
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Check if the plan is actually free using metadata
    const isFree = plan.pricing_metadata?.base_amount_monthly === 0;

    if (!isFree) {
      throw new AppError('This is a paid plan. Use payment endpoint instead.', 400, 'PAID_PLAN');
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Update user with free plan
    user.plan_id = planId as any;
    user.subscription_status = 'trial';

    // Set trial end date for free plans
    if (!user.subscription_ends_at) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);
      user.subscription_ends_at = trialEnd;
    }

    await user.save();

    // Update user's onboarding phase
    await User.findByIdAndUpdate(userId, {
      $set: {
        onboardingPhase: 'plan_selection',
        'phaseCompletedAt.planSelection': new Date(),
      },
    });

    // Populate for response
    await user.populate('plan_id');

    res.json({
      data: {
        message: 'Free plan activated successfully!',
        subscription: {
          id: user._id,
          status: user.subscription_status,
          plan: user.plan_id,
          trialEndsAt: user.subscription_ends_at,
        },
        nextStep: 'model_setup',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Subscription Status
 * Desktop app calls this after payment to verify status
 */
export const getSubscriptionStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // Fetch user 
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Get complete subscription details using helper (standardizes architecture)
    const subscriptionDetails = await getSubscriptionDetails(user);

    res.json({
      success: true,
      data: subscriptionDetails
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check Payment Session Status
 * Polling endpoint for checkout success page
 */
export const checkSessionStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const session = await PaymentSession.findOne({
      stripeSessionId: sessionId
    }).populate('planId');

    if (!session) {
      console.log(`❌ Session not found in DB for ID: ${sessionId}`);
      throw new AppError('Payment session not found', 404, 'SESSION_NOT_FOUND');
    }

    // Security check: Ensure this session belongs to the requesting user
    if (session.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized access to payment session', 403, 'FORBIDDEN');
    }

    // If session is completed, get full architecture from user record
    let subscriptionDetails = null;
    if (session.status === 'completed') {
      const user = await User.findById(userId);
      if (user) {
        subscriptionDetails = await getSubscriptionDetails(user);
      }
    }

    // Prepare session-specific plan summary (from PaymentSession entry)
    const sessionPlanSummary = session.planId
      ? {
        id: session.planId._id || session.planId.id,
        name: session.planId.display_name || session.planId.name || null,
        slug: session.planId.slug || null,
        description: session.planId.description || null,
        features: session.planId.features || [],
      }
      : null;

    res.json({
      data: {
        status: session.status,
        isCompleted: session.status === 'completed',
        amount: session.amount / 100, // Convert to real units
        currency: session.currency,
        plan: sessionPlanSummary, // Original session plan
        ...(subscriptionDetails ? { ...subscriptionDetails } : {})
      }
    });
  } catch (error) {
    next(error);
  }
};


