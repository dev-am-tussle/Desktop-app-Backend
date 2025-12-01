import { Request, Response, NextFunction } from 'express';
import { Payment, User, SubscriptionPlan, Subscription, PaymentSession } from '../models';
import { AppError } from '../middleware/errorHandler';
import * as stripeService from '../utils/stripe';

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
        .populate('planId', 'name price currency')
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
      .populate('planId', 'name price currency billingPeriod');

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
 * Desktop app calls this to initiate payment
 * Returns checkout URL that desktop app opens in browser
 */
export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
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

    if (!plan.stripePriceId) {
      throw new AppError('Plan not configured for Stripe payments', 500, 'STRIPE_NOT_CONFIGURED');
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
      priceId: plan.stripePriceId,
      userId: userId.toString(),
      planId: planId.toString(),
      mode: plan.billingPeriod === 'one-time' ? 'payment' : 'subscription',
    });
    
    console.log('✅ Checkout Session Created:', checkoutSession.id);

    // Save payment session to database
    await PaymentSession.create({
      userId,
      planId,
      stripeSessionId: checkoutSession.id,
      stripeCustomerId,
      status: 'pending',
      amount: plan.price,
      currency: plan.currency,
    });

    res.json({
      data: {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
        message: 'Open this URL in browser to complete payment',
      },
    });
  } catch (error: any) {
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
    const { planId, paymentMethod, transactionId, amount } = req.body;
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

    // Find user's subscription
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['trial', 'active'] },
    });

    if (!subscription) {
      throw new AppError('No subscription found for user', 404, 'NO_SUBSCRIPTION');
    }

    // Verify amount matches plan price
    if (amount !== plan.price) {
      throw new AppError('Payment amount does not match plan price', 400, 'AMOUNT_MISMATCH');
    }

    // Create payment record
    const payment = await Payment.create({
      userId,
      planId,
      amount,
      currency: plan.currency,
      method: paymentMethod,
      status: 'completed',
      transactionId,
      date: new Date(),
    });

    // Update subscription with plan and activate
    subscription.planId = planId as any;
    subscription.status = 'active';
    
    // Set next billing date based on billing period
    const nextBilling = new Date();
    if (plan.billingPeriod === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else if (plan.billingPeriod === 'yearly') {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }
    subscription.nextBillingDate = nextBilling;

    // Clear trial end date for active subscriptions
    subscription.trialEndsAt = undefined;

    await subscription.save();

    // Update user's onboarding phase
    await User.findByIdAndUpdate(userId, {
      $set: {
        onboardingPhase: 'payment_processing',
        'phaseCompletedAt.paymentProcessing': new Date(),
      },
    });

    // Populate for response
    await subscription.populate('planId');

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
          id: subscription._id,
          status: subscription.status,
          plan: subscription.planId,
          nextBillingDate: subscription.nextBillingDate,
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

    if (plan.price > 0) {
      throw new AppError('This is a paid plan. Use payment endpoint instead.', 400, 'PAID_PLAN');
    }

    // Find user's subscription
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['trial', 'active'] },
    });

    if (!subscription) {
      throw new AppError('No subscription found for user', 404, 'NO_SUBSCRIPTION');
    }

    // Update subscription with free plan
    subscription.planId = planId as any;
    subscription.status = 'trial';
    
    // Keep trial end date for free plans
    if (!subscription.trialEndsAt) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);
      subscription.trialEndsAt = trialEnd;
    }

    await subscription.save();

    // Update user's onboarding phase
    await User.findByIdAndUpdate(userId, {
      $set: {
        onboardingPhase: 'plan_selection',
        'phaseCompletedAt.planSelection': new Date(),
      },
    });

    // Populate for response
    await subscription.populate('planId');

    res.json({
      data: {
        message: 'Free plan activated successfully!',
        subscription: {
          id: subscription._id,
          status: subscription.status,
          plan: subscription.planId,
          trialEndsAt: subscription.trialEndsAt,
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
    console.log('🔍 Subscription status request received');
    console.log('📋 req.user:', req.user);
    
    const userId = req.user?.userId;

    if (!userId) {
      console.log('❌ No userId in token');
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    console.log('✅ User ID from token:', userId);

    // Fetch user with subscription details
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Fetch active subscription
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] },
    }).populate('planId');

    if (!subscription) {
      return res.json({
        data: {
          active: false,
          subscriptionStatus: 'none',
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          message: 'No active subscription',
        },
      });
    }

    res.json({
      data: {
        active: subscription.status === 'active',
        subscriptionStatus: subscription.status,
        plan: subscription.planId,
        validUntil: subscription.nextBillingDate || subscription.trialEndsAt,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          status: user.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

