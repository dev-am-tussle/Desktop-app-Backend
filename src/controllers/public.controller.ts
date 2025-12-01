import { Request, Response, NextFunction } from 'express';
import { User, SubscriptionPlan, Subscription, Payment } from '../models';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';

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

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'user',
      status: 'active',
      onboardingPhase: 'account_created',
      phaseCompletedAt: {
        accountCreated: new Date(),
      },
    });

    // Create trial subscription (30 days)
    const trialPlan = await SubscriptionPlan.findOne({ name: /trial/i, status: 'active' });
    if (trialPlan) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      await Subscription.create({
        userId: user._id,
        planId: trialPlan._id,
        status: 'trial',
        trialEndsAt: trialEnd,
      });
    }

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
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          onboardingPhase: user.onboardingPhase,
        },
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

    // Get active subscription
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'trial'] },
    }).populate('planId');

    // Check trial expiry
    if (subscription && subscription.status === 'trial' && subscription.trialEndsAt) {
      if (subscription.trialEndsAt < new Date()) {
        subscription.status = 'cancelled';
        await subscription.save();
      }
    }

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const tokenExpiry = subscription?.status === 'active' ? '90d' : subscription?.status === 'trial' ? '30d' : '7d';

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
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          onboardingPhase: user.onboardingPhase,
          lastActivePhase: user.lastActivePhase,
        },
        subscription: subscription ? {
          status: subscription.status,
          planName: (subscription.planId as any)?.name,
          trialEndsAt: subscription.trialEndsAt,
          nextBillingDate: subscription.nextBillingDate,
        } : null,
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

    // Get active subscription
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'trial'] },
    }).populate('planId');

    // Check trial expiry
    if (subscription && subscription.status === 'trial' && subscription.trialEndsAt) {
      if (subscription.trialEndsAt < new Date()) {
        subscription.status = 'cancelled';
        await subscription.save();
      }
    }

    res.json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
          onboardingPhase: user.onboardingPhase,
          phaseCompletedAt: user.phaseCompletedAt,
          lastActivePhase: user.lastActivePhase,
        },
        subscription: subscription ? {
          status: subscription.status,
          plan: subscription.planId,
          trialEndsAt: subscription.trialEndsAt,
          nextBillingDate: subscription.nextBillingDate,
        } : null,
      },
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
      amount: plan.price,
      currency: plan.currency,
      method: paymentMethod,
      status: 'completed', // Simplified - in real app, integrate payment gateway
      transactionId: `TXN-${Date.now()}-${user._id}`,
    });

    // Cancel any existing active subscription
    await Subscription.updateMany(
      { userId: user._id, status: { $in: ['active', 'trial'] } },
      { $set: { status: 'cancelled' } }
    );

    // Create new subscription
    const nextBilling = new Date();
    if (plan.billingPeriod === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else if (plan.billingPeriod === 'yearly') {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }

    const subscription = await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'active',
      nextBillingDate: plan.billingPeriod !== 'one-time' ? nextBilling : undefined,
    });

    // Update user onboarding phase
    user.onboardingPhase = 'payment_processing';
    if (!user.phaseCompletedAt) user.phaseCompletedAt = {};
    user.phaseCompletedAt.paymentProcessing = new Date();
    user.lastActivePhase = 'payment_processing';
    await user.save();

    res.json({
      data: {
        payment,
        subscription,
        user: {
          id: user._id,
          onboardingPhase: user.onboardingPhase,
        },
        message: 'Payment successful! Subscription activated.',
      },
    });
  } catch (error) {
    next(error);
  }
};
