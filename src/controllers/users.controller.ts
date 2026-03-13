import { Request, Response, NextFunction } from 'express';
import { User, InstalledModel, ApiKey, License, Payment, Conversation, CouponRedemption } from '../models';
import SubscriptionPlan from '../models/SubscriptionPlan.model';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import entitlementsService from '../services/entitlements.service';
import { getSubscriptionDetails } from '../utils/userHelpers';

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

    // Get complete subscription details using helper
    const subscriptionDetails = await getSubscriptionDetails(user);

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
      subscription: subscriptionDetails,
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
      phaseCompletedAt: {
        accountCreated: new Date(),
      },
      tags: ['new-user'],
      preferences: {
        defaultModel: 'gemma',
        offlineMode: true,
      },
      consent,
    });

    await user.save();

    // Get complete subscription details using helper
    const subscriptionDetails = await getSubscriptionDetails(user);

    // Warm up entitlement snapshot for new user (caches for offline app)
    try {
      await entitlementsService.resolveUserEntitlements(user._id);
    } catch (error: any) {
      console.warn('Failed to generate entitlement snapshot during registration:', error.message);
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
        ...subscriptionDetails,
        authentication: {
          sessionToken,
          refreshToken,
          expiresAt: sessionExpiresAt.toISOString(),
          sessionDuration: `${sessionExpiryDays} days`,
          message: 'Use sessionToken for offline app authentication',
        },
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

    // Get complete subscription details using helper
    const subscriptionDetails = await getSubscriptionDetails(user);

    const subscriptionStatus = user.subscription_status || 'none';

    // Determine session duration based on subscription status

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

    // Ensure entitlement snapshot is generated (caches for offline use)
    try {
      await entitlementsService.resolveUserEntitlements(user._id);
    } catch (error: any) {
      console.warn('Failed to generate entitlement snapshot:', error.message);
    }

    res.json({
      data: {
        ...subscriptionDetails,
        authentication: {
          sessionToken,
          refreshToken,
          expiresAt: sessionExpiresAt.toISOString(),
          sessionDuration: `${sessionExpiryDays} days`,
          message: 'Use sessionToken for offline app authentication',
        },
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

    const subscriptionTokenStatus = user.subscription_status === 'active' ? 'paid' : 'trial';

    const sessionToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        subscriptionStatus,
        sessionType: subscriptionTokenStatus,
      },
      process.env.JWT_SECRET!,
      { expiresIn: `${sessionExpiryDays}d` }
    );

    // Get subscription details for response
    const subscriptionDetails = await getSubscriptionDetails(user);

    res.json({
      data: {
        ...subscriptionDetails,
        authentication: {
          sessionToken,
          expiresAt: sessionExpiresAt.toISOString(),
          sessionDuration: `${sessionExpiryDays} days`,
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

    // Calculate remaining session time
    const tokenExp = req.user?.exp || 0;
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = tokenExp - now;
    const remainingDays = Math.floor(remainingSeconds / 86400);

    // Get subscription details for response
    const subscriptionDetails = await getSubscriptionDetails(user);

    res.json({
      data: {
        ...subscriptionDetails,
        session: {
          expiresAt: new Date(tokenExp * 1000).toISOString(),
          remainingDays,
          needsRenewal: remainingDays < 7,
          valid: true,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot Password
 * Generates a reset token and sends it via response (Note: In production should be sent via Email)
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // For security reasons, don't reveal if user exists or not
      res.json({
        success: true,
        message: 'If an account with that email exists, a reset token has been generated.',
      });
      return;
    }

    // Generate random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiry (1 hour)
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();

    // NOTE: In a real-world scenario, you would send this token via email.
    // Since we don't have an email service set up, we return it in the response for demo/testing.
    res.json({
      success: true,
      message: 'Password reset token generated.',
      data: {
        resetToken, // THIS SHOULD ONLY BE SENT VIA EMAIL IN PRODUCTION
      },
    });
    return;
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password (Simple version)
 * Resets password using email and new password directly
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      throw new AppError('User not found with this email', 404, 'USER_NOT_FOUND');
    }

    // Set new password (will be hashed by pre-save hook in User model)
    user.password = password;
    
    // Clear reset tokens if they exist from previous attempt
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: 'Password has been updated successfully.',
    });
    return;
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
