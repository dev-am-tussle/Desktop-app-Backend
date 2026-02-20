import { Request, Response, NextFunction } from 'express';
import { User, InstalledModel, ApiKey, License, Payment, Conversation, CouponRedemption } from '../models';
import SubscriptionPlan from '../models/SubscriptionPlan.model';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import entitlementsService from '../services/entitlements.service';
import { formatPlanPricing } from '../utils/formatters';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;

    // Build filter object
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) filter.role = role;
    if (status) filter.status = status;

    // Execute query with pagination
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('plan_id')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Get all user IDs to check for coupon redemptions
    const userIds = users.map(u => u._id);
    
    // Fetch coupon redemptions for these users in bulk
    const couponRedemptions = await CouponRedemption.find({
      user_id: { $in: userIds }
    }).select('user_id').lean();
    
    // Create a Set of user IDs who have redeemed coupons
    const couponUserIds = new Set(couponRedemptions.map(cr => cr.user_id.toString()));

    // Add access_type to each user
    const usersWithAccessType = users.map(user => {
      let access_type = 'free';
      
      if (user.stripeSubscriptionId) {
        access_type = 'stripe';
      } else if (couponUserIds.has(user._id.toString())) {
        access_type = 'coupon';
      } else if (user.subscription_status === 'trial') {
        access_type = 'trial';
      }
      
      return {
        ...user,
        access_type,
      };
    });

    res.json({
      data: usersWithAccessType,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role = 'user', status = 'active' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    console.log(existingUser);
    if (existingUser) {
      throw new AppError('User with this email already exists', 400, 'USER_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      status,
    });

    // Return user without password
    const userResponse = await User.findById(user._id).select('-password').lean();

    res.status(201).json({
      data: userResponse,
      message: 'User created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password').lean();

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Fetch related data in parallel
    const [apiKeys, licenses, payments, installedModels, conversationsCount] = await Promise.all([
      ApiKey.find({ userId: id }).select('-key').lean(),
      License.find({ userId: id }).lean(),
      Payment.find({ userId: id }).sort({ date: -1 }).limit(10).lean(),
      InstalledModel.find({ userId: id }).populate('modelId', 'name').lean(),
      Conversation.countDocuments({ userId: id }),
    ]);

    const userDetail = {
      ...user,
      apiKeys,
      licenses,
      payments,
      installedModels,
      conversationsCount,
      modelsInstalled: installedModels.length,
    };

    res.json({ data: userDetail });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, role, status, tags } = req.body;

    // Build update object
    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (role !== undefined) updateFields.role = role;
    if (status !== undefined) updateFields.status = status;
    if (tags !== undefined) updateFields.tags = tags;

    if (Object.keys(updateFields).length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATES');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Delete related data (cascade)
    await Promise.all([
      ApiKey.deleteMany({ userId: id }),
      License.updateMany({ userId: id }, { $set: { userId: null } }),
      InstalledModel.deleteMany({ userId: id }),
      Conversation.deleteMany({ userId: id }),
    ]);

    res.json({ data: { message: 'User deleted successfully' } });
  } catch (error) {
    next(error);
  }
};

export const impersonateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Generate temporary JWT token for impersonation
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        impersonatedBy: req.user?.userId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    res.json({
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkDisableUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('Invalid user IDs', 400, 'INVALID_USER_IDS');
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { status: 'disabled' } }
    );

    res.json({
      data: {
        message: `${result.modifiedCount} users disabled successfully`,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// PUBLIC ENDPOINTS - User Registration & Login
// ============================================

/**
 * Register new user (First-time setup in Sovereign AI app)
 * Creates user with free trial status
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, consent: consentData } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Get Free Plan ID
    const freePlan = await SubscriptionPlan.findOne({ name: 'free', status: 'active' });
    if (!freePlan) {
      throw new AppError('Free plan not found. Please contact support.', 500, 'FREE_PLAN_NOT_FOUND');
    }

    // Calculate trial end date (30 days)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    // Prepare consent info
    const now = new Date();
    const consent = {
      termsAccepted: consentData?.termsAccepted || false,
      termsAcceptedAt: consentData?.termsAcceptedAt ? new Date(consentData.termsAcceptedAt) : now,
      termsVersion: consentData?.termsVersion || 'v1',
    }; 

    // Create new user with trial status and Free plan
    const user = new User({
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      role: 'user',
      status: 'active',
      plan_id: freePlan._id,
      subscription_status: 'trial',
      subscription_ends_at: trialEnd,
      onboardingPhase: 'account_created',
      tags: ['new-user'],
      preferences: {
        defaultModel: 'gemma',
        offlineMode: true,
      },
      consent,
    });

    await user.save();

    // Generate entitlement snapshot for new user
    let entitlementSnapshot = null;
    try {
      entitlementSnapshot = await entitlementsService.resolveUserEntitlements(user._id);
    } catch (error: any) {
      console.warn('Failed to generate entitlement snapshot during registration:', error.message);
      // Continue without entitlements - user can sync later
    }

    // Calculate session expiry (30 days for trial)
    const sessionExpiryDays = 30;
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + sessionExpiryDays);

    // Generate session token for offline usage
    const sessionToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        subscriptionStatus: 'trial',
        sessionType: 'trial',
      },
      process.env.JWT_SECRET!,
      { expiresIn: `${sessionExpiryDays}d` }
    );

    // Generate refresh token (for re-authentication)
    const refreshToken = jwt.sign(
      {
        userId: user._id.toString(),
        type: 'refresh',
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
          status: user.status,
          subscriptionStatus: user.subscription_status,
          plan: freePlan,
          trialEndsAt: user.subscription_ends_at,
          createdAt: user.createdAt,
          consent: user.consent,
        },
        authentication: {
          sessionToken,
          refreshToken,
          expiresAt: sessionExpiresAt.toISOString(),
          sessionDuration: `${sessionExpiryDays} days`,
          message: 'Use sessionToken for offline app authentication',
        },
        entitlements: entitlementSnapshot ? {
          capabilities: entitlementSnapshot.entitlements.capabilities,
          limits: entitlementSnapshot.entitlements.limits,
          resources: entitlementSnapshot.entitlements.resources,
          deployment: entitlementSnapshot.entitlements.deployment,
          support: entitlementSnapshot.entitlements.support,
          issued_at: entitlementSnapshot.issued_at,
          valid_until: entitlementSnapshot.valid_until,
          offline_allowed: entitlementSnapshot.offline_allowed,
          signature: entitlementSnapshot.signature,
        } : null,
        nextSteps: {
          step1: 'Download Gemma model (default)',
          step2: 'Choose subscription plan or continue with trial',
          step3: 'Start using offline with session token',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login existing user
 * Returns session token for offline usage
 */
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user with password field (normally excluded)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is disabled
    if (user.status === 'disabled') {
      throw new AppError('Account has been disabled. Contact support.', 403, 'ACCOUNT_DISABLED');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Get plan details from user.plan_id
    let planDetails = null;
    if (user.plan_id) {
      const plan = await SubscriptionPlan.findById(user.plan_id).lean();
      if (plan) {
        planDetails = formatPlanPricing({
          ...plan,
          id: plan._id,
        });
      }
    }

    // Handle coupon-based subscription - Priority over standard plan display if active via coupon
    if (user.subscription_status === 'active' && !user.stripeSubscriptionId) {
      const lastRedemption = await CouponRedemption.findOne({ user_id: user._id }).sort({ redeemed_at: -1 });
      if (lastRedemption) {
        planDetails = {
          ...(planDetails || {}),
          id: lastRedemption.coupon_id,
          name: 'coupon',
          display_name: planDetails?.display_name || 'Custom Individual Plan (Coupon)',
          slug: 'coupon-access',
          description: 'Access granted via coupon redemption',
          category: 'personal',
          features: planDetails?.features || []
        };
      }
    }

    const subscriptionStatus = user.subscription_status || 'none';

    // Determine session duration based on subscription status
    let sessionExpiryDays = 30; // Default for trial
    if (subscriptionStatus === 'active') {
      sessionExpiryDays = 90; // 90 days for paid subscribers
    } else if (subscriptionStatus === 'cancelled') {
      sessionExpiryDays = 7; // 7 days grace period
    }

    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + sessionExpiryDays);

    // Generate session token for offline usage
    const sessionToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        subscriptionStatus,
        sessionType: subscriptionStatus === 'active' ? 'paid' : 'trial',
      },
      process.env.JWT_SECRET!,
      { expiresIn: `${sessionExpiryDays}d` }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        userId: user._id.toString(),
        type: 'refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '90d' }
    );

    // Generate entitlement snapshot
    let entitlementSnapshot = null;
    try {
      entitlementSnapshot = await entitlementsService.resolveUserEntitlements(user._id);
    } catch (error: any) {
      console.warn('Failed to generate entitlement snapshot:', error.message);
      // Continue without entitlements if service fails
    }

    res.json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          lastSeen: user.lastSeen,
          tags: user.tags || [],
          onboardingPhase: user.onboardingPhase,
          createdAt: user.createdAt,
          consent: user.consent,
        },
        subscription: {
          status: subscriptionStatus,
          subscription_ends_at: user.subscription_ends_at || null,
          grace_period_until: user.grace_period_until || null,
          stripeSubscriptionId: user.stripeSubscriptionId || null,
          plan: planDetails,
        },
        authentication: {
          sessionToken,
          refreshToken,
          expiresAt: sessionExpiresAt.toISOString(),
          sessionDuration: `${sessionExpiryDays} days`,
          message: 'Use sessionToken for offline app authentication',
        },
        entitlements: entitlementSnapshot ? {
          capabilities: entitlementSnapshot.entitlements.capabilities,
          limits: entitlementSnapshot.entitlements.limits,
          resources: entitlementSnapshot.entitlements.resources,
          deployment: entitlementSnapshot.entitlements.deployment,
          support: entitlementSnapshot.entitlements.support,
          issued_at: entitlementSnapshot.issued_at,
          valid_until: entitlementSnapshot.valid_until,
          offline_allowed: entitlementSnapshot.offline_allowed,
          signature: entitlementSnapshot.signature,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh session token
 * Used when session token expires and user comes online
 */
export const refreshSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Get user
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.status === 'disabled') {
      throw new AppError('Account has been disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Get subscription status from user
    const subscriptionStatus = user.subscription_status || 'none';

    // Generate new session token
    let sessionExpiryDays = 30;
    if (subscriptionStatus === 'active') {
      sessionExpiryDays = 90;
    } else if (subscriptionStatus === 'cancelled') {
      sessionExpiryDays = 7;
    } else if (subscriptionStatus === 'expired') {
      sessionExpiryDays = 1;
    }

    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + sessionExpiryDays);

    const sessionToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        subscriptionStatus,
        sessionType: subscriptionStatus === 'active' ? 'paid' : 'trial',
      },
      process.env.JWT_SECRET!,
      { expiresIn: `${sessionExpiryDays}d` }
    );

    res.json({
      data: {
        sessionToken,
        expiresAt: sessionExpiresAt.toISOString(),
        sessionDuration: `${sessionExpiryDays} days`,
        user: {
          id: user._id,
          subscriptionStatus,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify session token
 * Used by desktop app to check if token is still valid
 */
export const verifySession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Token is already verified by authenticateToken middleware
    const userId = req.user?.userId;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.status === 'disabled') {
      throw new AppError('Account has been disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Get subscription status from user
    const subscriptionStatus = user.subscription_status || 'none';

    // Calculate remaining session time
    const tokenExp = req.user?.exp || 0;
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = tokenExp - now;
    const remainingDays = Math.floor(remainingSeconds / 86400);

    res.json({
      data: {
        valid: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          subscriptionStatus,
          status: user.status,
        },
        session: {
          expiresAt: new Date(tokenExp * 1000).toISOString(),
          remainingDays,
          needsRenewal: remainingDays < 7,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke User Plan
 * Moves user back to Free tier and cancels Stripe subscription if active
 * POST /api/users/revoke-plan
 */
export const revokePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Find the Free plan
    const freePlan = await SubscriptionPlan.findOne({ name: /free/i });
    if (!freePlan) {
      console.warn('⚠️ No "Free" plan found in database during revocation.');
    }

    // 1. Cancel in Stripe if exists
    // if (user.stripeSubscriptionId) {
    //   try {
    //     const { cancelStripeSubscription } = require('../utils/stripe');
    //     await cancelStripeSubscription(user.stripeSubscriptionId);
    //   } catch (err: any) {
    //     console.error('❌ Stripe Revocation Error:', err.message);
    //     // We continue even if stripe fails, as the intention is to revoke access in our system
    //   }
    // }

    // 2. Update user fields
    user.plan_id = freePlan ? (freePlan._id as any) : undefined;
    user.subscription_status = 'cancelled';
    user.stripeSubscriptionId = undefined;
    
    // Reset onboarding phase if they were in a payment/processing state
    if (user.onboardingPhase === 'payment_processing') {
      user.onboardingPhase = 'plan_selection';
    }
    
    await user.save();

    // 3. Clear entitlement cache (Revoke all active snapshots)
    const { EntitlementCache } = require('../models');
    await EntitlementCache.updateMany(
      { user_id: userId },
      { $set: { revoked: true } }
    );

    // Force re-resolve entitlements to update cache immediately
    await entitlementsService.resolveUserEntitlements(userId);

    res.json({
      success: true,
      message: 'Plan revoked successfully. You have been moved to the free tier.',
      data: {
        plan_id: user.plan_id,
        subscription_status: user.subscription_status,
        onboardingPhase: user.onboardingPhase
      }
    });
  } catch (error) {
    next(error);
  }
};
