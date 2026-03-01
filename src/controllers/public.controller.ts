// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { User, SubscriptionPlan, Payment, CouponRedemption } from '../models';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import { getSubscriptionDetails } from '../utils/userHelpers';

// ============================================
// PUBLIC USER CONTROLLERS (Desktop App)
// ============================================

/**
 * Public User Registration
 * Register new user with automatic trial subscription
 */
export const registerPublicUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('Email already registered', 400, 'EMAIL_EXISTS');
    }

    // Get Free plan (default for new users)
    const freePlan = await SubscriptionPlan.findOne({ slug: 'free' });
    if (!freePlan) {
      throw new AppError('Free plan not configured', 500, 'PLAN_NOT_FOUND');
    }

    // Create user with Free plan
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'user',
      status: 'active',
      plan_id: freePlan._id,
      subscription_status: 'trial',
      onboardingPhase: 'account_created',
      tags: ['new-user'],
      phaseCompletedAt: {
        accountCreated: new Date(),
      },
    });

    // Get complete subscription details using helper
    const subscriptionDetails = await getSubscriptionDetails(user);

    // Generate session token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const sessionToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        type: 'user',
      },
      jwtSecret,
      { expiresIn: '30d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        userId: user._id.toString(),
        type: 'user-refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '90d' }
    );

    res.status(201).json({
      data: {
        ...subscriptionDetails,
        authentication: {
          sessionToken,
          refreshToken,
          expiresIn: '30 days',
          message: 'Registration successful!',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public User Login
 */
export const loginPublicUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is disabled
    if (user.status === 'disabled') {
      throw new AppError('Account has been disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Get complete subscription details using helper
    const subscriptionDetails = await getSubscriptionDetails(user);

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const tokenExpiry = user.subscription_status === 'active' ? '90d' : user.subscription_status === 'trial' ? '30d' : '7d';

    const sessionToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        type: 'user',
      },
      jwtSecret,
      { expiresIn: tokenExpiry }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        userId: user._id.toString(),
        type: 'user-refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '90d' }
    );

    res.json({
      data: {
        ...subscriptionDetails,
        authentication: {
          sessionToken,
          refreshToken,
          expiresIn: tokenExpiry,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Public Plans (No Auth Required)
 */
export const getPublicPlans = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await SubscriptionPlan.find({ status: 'active' }).sort({ _id: -1 });

    res.json({
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Profile
 */
export const getPublicUserProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Get complete subscription details using helper
    const subscriptionDetails = await getSubscriptionDetails(user);

    res.json({
      data: subscriptionDetails,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User Chooses Plan
 */
export const choosePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { planId } = req.body;

    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Update onboarding phase
    user.onboardingPhase = 'plan_selection';
    if (!user.phaseCompletedAt) user.phaseCompletedAt = {};
    user.phaseCompletedAt.planSelection = new Date();
    user.lastActivePhase = 'plan_selection';
    await user.save();

    res.json({
      data: {
        user: {
          id: user._id,
          onboardingPhase: user.onboardingPhase,
        },
        plan,
        message: 'Plan selected successfully. Proceed to payment.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process Payment
 */
export const processPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { planId, paymentMethod } = req.body;

    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Create payment record
    const payment = await Payment.create({
      userId: user._id,
      planId: plan._id,
      amount: plan.price_monthly || plan.price_yearly || 0,
      currency: plan.currency || 'AUD',
      method: paymentMethod,
      status: 'completed', // Simplified - in real app, integrate payment gateway
      transactionId: `TXN-${Date.now()}-${user._id}`,
    });

    // Update user plan and subscription status
    const subscriptionEnds = new Date();
    // If slug contains yearly or is enterprise, assume yearly, else monthly
    if (plan.slug.includes('yearly') || plan.slug === 'enterprise') {
      subscriptionEnds.setFullYear(subscriptionEnds.getFullYear() + 1);
    } else {
      subscriptionEnds.setMonth(subscriptionEnds.getMonth() + 1);
    }

    user.plan_id = plan._id as any;
    user.subscription_status = 'active';
    user.subscription_ends_at = subscriptionEnds;
    user.onboardingPhase = 'payment_processing';
    if (!user.phaseCompletedAt) user.phaseCompletedAt = {};
    user.phaseCompletedAt.paymentProcessing = new Date();
    user.lastActivePhase = 'payment_processing';
    await user.save();

    // Invalidate old entitlement cache (user upgraded)
    const { EntitlementCache } = require('../models');
    await EntitlementCache.updateMany(
      { user_id: user._id.toString() },
      { $set: { revoked: true } }
    );

    // Get complete subscription details using standard helper
    const subscriptionDetails = await getSubscriptionDetails(user);

    res.json({
      data: {
        payment,
        ...subscriptionDetails,
        message: 'Payment successful! Subscription activated.',
      },
    });
  } catch (error) {
    next(error);
  }
};

