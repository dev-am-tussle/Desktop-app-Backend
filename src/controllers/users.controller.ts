import { Request, Response, NextFunction } from 'express';
import { User, InstalledModel, ApiKey, License, Payment, Conversation, Subscription } from '../models';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

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
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      data: users,
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
    const { name, email, role, status, tags, preferences } = req.body;

    // Build update object
    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (role !== undefined) updateFields.role = role;
    if (status !== undefined) updateFields.status = status;
    if (tags !== undefined) updateFields.tags = tags;
    if (preferences !== undefined) updateFields.preferences = preferences;

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
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    // console.log(existingUser);
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Create new user with trial status
    const user = new User({
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      role: 'user',
      status: 'active',
      onboardingPhase: 'account_created',
      tags: ['new-user'],
      preferences: {
        defaultModel: 'gemma',
        offlineMode: true,
      },
    });

    await user.save();

    // Create trial subscription (30 days)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    
    await Subscription.create({
      userId: user._id,
      planId: null, // No plan selected yet
      status: 'trial',
      trialEndsAt: trialEnd,
    });

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
          subscriptionStatus: 'trial',
          createdAt: user.createdAt,
        },
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

    // Get subscription status with plan details
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'trial', 'cancelled', 'paused'] },
    }).populate('planId').lean();

    const subscriptionStatus = subscription ? subscription.status : 'none';

    // Get plan details if subscription has a plan
    let planDetails = null;
    if (subscription && subscription.planId) {
      const plan = subscription.planId as any;
      planDetails = {
        id: plan._id || plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        billingPeriod: plan.billingPeriod,
        features: plan.features || [],
        seats: plan.seats,
        maxModels: plan.maxModels,
        offlineModelSizeLimit: plan.offlineModelSizeLimit,
        status: plan.status,
      };
    }

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

    res.json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          lastSeen: user.lastSeen,
          preferences: user.preferences,
          tags: user.tags || [],
          onboardingPhase: user.onboardingPhase,
          createdAt: user.createdAt,
        },
        subscription: {
          status: subscriptionStatus,
          nextBillingDate: subscription?.nextBillingDate || null,
          trialEndsAt: subscription?.trialEndsAt || null,
          stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
          plan: planDetails,
        },
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

    // Get subscription status
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'trial'] },
    });
    const subscriptionStatus = subscription ? subscription.status : 'none';

    // Generate new session token
    let sessionExpiryDays = 30;
    if (subscriptionStatus === 'active') {
      sessionExpiryDays = 90;
    } else if (subscriptionStatus === 'cancelled') {
      sessionExpiryDays = 7;
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

    // Get subscription status
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'trial'] },
    });
    const subscriptionStatus = subscription ? subscription.status : 'none';

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
