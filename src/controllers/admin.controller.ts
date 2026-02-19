import { Request, Response, NextFunction } from 'express';
import { Admin } from '../models';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import EntitlementDefinition from '../models/EntitlementDefinition.model';
import SubscriptionPlan from '../models/SubscriptionPlan.model';
import PlanEntitlement from '../models/PlanEntitlement.model';
import * as stripeService from '../utils/stripe';
import CouponService from '../services/coupon.service';

// ============================================
// ADMIN AUTHENTICATION CONTROLLERS
// ============================================

/**
 * Admin Login
 * Authenticates admin users for accessing admin portal
 */
export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find admin with password field
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password +loginAttempts +lockUntil');

    if (!admin) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if account is locked
    if (admin.isLocked()) {
      const lockTime = admin.lockUntil ? Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60000) : 0;
      throw new AppError(
        `Account is locked due to multiple failed login attempts. Try again in ${lockTime} minutes.`,
        403,
        'ACCOUNT_LOCKED'
      );
    }

    // Check if account is disabled
    if (admin.status === 'disabled') {
      throw new AppError('Account has been disabled. Contact admin.', 403, 'ACCOUNT_DISABLED');
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      await admin.incrementLoginAttempts();
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Reset login attempts on successful login
    await admin.resetLoginAttempts();

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate admin token (shorter expiry for security)
    const accessToken = jwt.sign(
      {
        adminId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        type: 'admin',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' } // 8 hours for admin sessions
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        adminId: admin._id.toString(),
        type: 'admin-refresh',
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
          avatar: admin.avatar,
          lastLogin: admin.lastLogin,
        },
        authentication: {
          accessToken,
          refreshToken,
          expiresIn: '8 hours',
          message: 'Use accessToken for admin portal authentication',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Token Refresh
 * Refresh expired admin access token using refresh token
 */
export const adminRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
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

    // Check token type
    if (decoded.type !== 'admin-refresh') {
      throw new AppError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
    }

    // Get admin
    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      throw new AppError('Admin not found', 404, 'ADMIN_NOT_FOUND');
    }

    if (admin.status === 'disabled') {
      throw new AppError('Account has been disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        adminId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        type: 'admin',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    res.json({
      data: {
        accessToken,
        expiresIn: '8 hours',
        admin: {
          id: admin._id,
          role: admin.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Admin Token
 * Check if current admin token is valid
 */
export const verifyAdminToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Token is already verified by authenticateAdminToken middleware
    const adminId = req.admin?.adminId;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw new AppError('Admin not found', 404, 'ADMIN_NOT_FOUND');
    }

    if (admin.status === 'disabled') {
      throw new AppError('Account has been disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Calculate remaining session time
    const tokenExp = req.admin?.exp || 0;
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = tokenExp - now;
    const remainingHours = Math.floor(remainingSeconds / 3600);

    res.json({
      data: {
        valid: true,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
        },
        session: {
          expiresAt: new Date(tokenExp * 1000).toISOString(),
          remainingHours,
          needsRenewal: remainingHours < 2,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Logout
 * Log admin logout activity (token invalidation handled client-side)
 */
export const adminLogout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin?.adminId;

    if (adminId) {
      // Optional: Log logout activity to audit logs
      // await AuditLog.create({...})
    }

    res.json({
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current Admin Profile
 * Get logged-in admin details
 */
export const getAdminProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin?.adminId;

    const admin = await Admin.findById(adminId).select('-password');
    if (!admin) {
      throw new AppError('Admin not found', 404, 'ADMIN_NOT_FOUND');
    }

    res.json({
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Admin Profile
 * Update logged-in admin's profile
 */
export const updateAdminProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin?.adminId;
    const { name, avatar } = req.body;

    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (avatar !== undefined) updateFields.avatar = avatar;

    if (Object.keys(updateFields).length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATES');
    }

    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!admin) {
      throw new AppError('Admin not found', 404, 'ADMIN_NOT_FOUND');
    }

    res.json({ data: admin });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Admin Password
 * Change logged-in admin's password
 */
export const changeAdminPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.admin?.adminId;
    const { currentPassword, newPassword } = req.body;

    const admin = await Admin.findById(adminId).select('+password');
    if (!admin) {
      throw new AppError('Admin not found', 404, 'ADMIN_NOT_FOUND');
    }

    // Verify current password
    const isPasswordValid = await admin.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.json({
      data: {
        message: 'Password changed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Admin
 * Allows an authenticated admin to create another admin/support user
 */
export const createAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role = 'admin', status = 'active' } = req.body;

    const normalizedEmail = email.toLowerCase();

    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      throw new AppError('Admin with this email already exists', 409, 'ADMIN_EXISTS');
    }

    const admin = await Admin.create({
      name,
      email: normalizedEmail,
      password,
      role,
      status,
    });

    res.status(201).json({
      data: admin,
      message: 'Admin created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ENTITLEMENT DEFINITION MANAGEMENT
// ============================================

/**
 * Create Entitlement Definition
 * POST /api/admin/entitlements/definitions
 * Allows admin to add new entitlement definitions via Postman
 */
export const createEntitlementDefinition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, type, category, description, default_value, validation_rules } = req.body;

    // Validation
    if (!key || !type || !category) {
      throw new AppError('key, type, and category are required fields', 400, 'VALIDATION_ERROR');
    }

    // Check if definition already exists
    const existing = await EntitlementDefinition.findOne({ key });
    if (existing) {
      throw new AppError(`Entitlement definition with key '${key}' already exists`, 409, 'DUPLICATE_KEY');
    }

    // Validate type
    const validTypes = ['boolean', 'number', 'string', 'array'];
    if (!validTypes.includes(type)) {
      throw new AppError(`Invalid type. Must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_TYPE');
    }

    // Validate category
    const validCategories = ['capabilities', 'limits', 'resources', 'deployment', 'support'];
    if (!validCategories.includes(category)) {
      throw new AppError(`Invalid category. Must be one of: ${validCategories.join(', ')}`, 400, 'INVALID_CATEGORY');
    }

    // Create the definition
    const definition = await EntitlementDefinition.create({
      key,
      type,
      category,
      description: description || '',
      default_value: default_value !== undefined ? default_value : null,
      validation_rules: validation_rules || null,
    });

    res.status(201).json({
      success: true,
      message: 'Entitlement definition created successfully',
      data: definition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Entitlement Definitions
 * GET /api/admin/entitlements/definitions
 */
export const getEntitlementDefinitions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, type } = req.query;

    // Build filter
    const filter: any = {};
    if (category) filter.category = category;
    if (type) filter.type = type;

    const definitions = await EntitlementDefinition.find(filter).sort({ category: 1, key: 1 });

    // Group by category
    const grouped = definitions.reduce((acc: any, def: any) => {
      if (!acc[def.category]) acc[def.category] = [];
      acc[def.category].push(def);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        total: definitions.length,
        definitions,
        grouped,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Entitlement Definition
 * PUT /api/admin/entitlements/definitions/:id
 */
export const updateEntitlementDefinition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { description, default_value, validation_rules } = req.body;

    const definition = await EntitlementDefinition.findById(id);
    if (!definition) {
      throw new AppError('Entitlement definition not found', 404, 'NOT_FOUND');
    }

    // Update only allowed fields (key, type, category should not change)
    if (description !== undefined) definition.description = description;
    if (default_value !== undefined) definition.default_value = default_value;
    if (validation_rules !== undefined) definition.validation_rules = validation_rules;

    await definition.save();

    res.status(200).json({
      success: true,
      message: 'Entitlement definition updated successfully',
      data: definition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Entitlement Definition
 * DELETE /api/admin/entitlements/definitions/:id
 */
export const deleteEntitlementDefinition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const definition = await EntitlementDefinition.findByIdAndDelete(id);
    if (!definition) {
      throw new AppError('Entitlement definition not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      message: 'Entitlement definition deleted successfully',
      data: { key: definition.key },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Plan with Entitlements
 * POST /api/admin/plans/create-with-entitlements
 * Creates a subscription plan and assigns entitlements in one transaction
 */
export const createPlanWithEntitlements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan, entitlements } = req.body;

    // Validate payload structure
    if (!plan || !entitlements || !Array.isArray(entitlements)) {
      throw new AppError('Invalid payload. Required: { plan: {...}, entitlements: [...] }', 400, 'INVALID_PAYLOAD');
    }

    // CHECK FOR DUPLICATE PLAN BEFORE STRIPE CREATION
    const existingPlan = await SubscriptionPlan.findOne({
      $or: [{ name: plan.name }, { slug: plan.slug }]
    });

    if (existingPlan) {
      const field = existingPlan.name === plan.name ? 'Name' : 'Slug';
      throw new AppError(`A plan with this ${field} already exists. Please use a unique ${field.toLowerCase()}.`, 400, 'DUPLICATE_PLAN');
    }

    // STEP 1: Create Stripe Product and Prices (except contact-sales plans)
    let stripeProductId = null;
    let stripePriceMonthlyId = null;
    let stripePriceYearlyId = null;

    if (!plan.is_contact_sales) {
      console.log('🔵 Creating Stripe product...');
      
      // Create Stripe Product (for all plans including free)
      const stripeProduct = await stripeService.createStripeProduct({
        name: plan.display_name,
        description: plan.description || `${plan.display_name} Subscription`,
      });
      stripeProductId = stripeProduct.id;
      console.log(`✅ Stripe Product created: ${stripeProductId}`);

      // Create Monthly Price (only if price_monthly is defined)
      if (plan.price_monthly !== undefined && plan.price_monthly !== null) {
        console.log('🔵 Creating monthly price...');
        const monthlyPrice = await stripeService.createStripePrice({
          productId: stripeProductId,
          amount: plan.price_monthly,
          currency: plan.currency || 'AUD',
          billingPeriod: 'monthly',
        });
        stripePriceMonthlyId = monthlyPrice.id;
        console.log(`✅ Monthly Price created: ${stripePriceMonthlyId} ($${plan.price_monthly})`);
      }

      // Create Yearly Price (only if price_yearly is defined and > 0)
      if (plan.price_yearly !== undefined && plan.price_yearly !== null && plan.price_yearly > 0) {
        console.log('🔵 Creating yearly price...');
        const yearlyPrice = await stripeService.createStripePrice({
          productId: stripeProductId,
          amount: plan.price_yearly,
          currency: plan.currency || 'AUD',
          billingPeriod: 'yearly',
        });
        stripePriceYearlyId = yearlyPrice.id;
        console.log(`✅ Yearly Price created: ${stripePriceYearlyId} ($${plan.price_yearly})`);
      }
    } else {
      console.log('⏭️  Skipping Stripe integration (contact sales plan)');
    }

    // STEP 2: Create Subscription Plan in Database
    console.log('📋 Creating subscription plan in database...');
    const newPlan = await SubscriptionPlan.create({
      name: plan.name,
      display_name: plan.display_name,
      slug: plan.slug,
      description: plan.description || '',
      features: plan.features || [],
      category: plan.category || 'personal',
      price_monthly: plan.price_monthly || 0,
      price_yearly: plan.price_yearly || 0,
      currency: plan.currency || 'USD',
      is_contact_sales: plan.is_contact_sales || false,
      status: plan.status || 'active',
      sort_order: plan.sort_order || 0,
      stripe_product_id: stripeProductId,
      stripe_price_monthly_id: stripePriceMonthlyId,
      stripe_price_yearly_id: stripePriceYearlyId,
    });
    console.log(`✅ Plan created: ${newPlan.display_name} (ID: ${newPlan._id})`);

    // STEP 3: Create Plan Entitlements
    console.log(`📋 Creating ${entitlements.length} entitlements...`);
    const planEntitlements = [];
    let successCount = 0;
    let errorCount = 0;

    for (const ent of entitlements) {
      try {
        // Verify entitlement definition exists
        const definition = await EntitlementDefinition.findOne({ key: ent.entitlement_key });
        if (!definition) {
          console.warn(`⚠️  Entitlement key not found: ${ent.entitlement_key}`);
          errorCount++;
          continue;
        }

        // Create plan entitlement
        const planEntitlement = await PlanEntitlement.create({
          plan_id: newPlan._id,
          entitlement_key: ent.entitlement_key,
          value: ent.value,
        });

        planEntitlements.push(planEntitlement);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Error creating entitlement ${ent.entitlement_key}:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ Entitlements created: ${successCount} success, ${errorCount} errors`);

    // STEP 4: Return response
    res.status(201).json({
      success: true,
      message: 'Plan with entitlements created successfully',
      data: {
        plan: newPlan,
        entitlements: planEntitlements,
        summary: {
          total_entitlements: entitlements.length,
          created: successCount,
          failed: errorCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// COUPON MANAGEMENT CONTROLLERS
// ============================================

/**
 * Create Coupon
 * Admin creates a new coupon for users to redeem
 */
export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      code,
      validity,
      max_redemptions,
      max_redemptions_per_user,
      description,
      expires_at,
      type,
      plan_id,
      entitlements,
      status,
      metadata
    } = req.body;

    const adminId = (req as any).admin.adminId;

    const coupon = await CouponService.createCoupon({
      code,
      validity,
      max_redemptions,
      max_redemptions_per_user,
      description,
      expires_at,
      type,
      plan_id,
      entitlements,
      status: status || 'active',
      metadata: metadata || [],
      createdBy: adminId
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: coupon
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Coupons
 * List all coupons with pagination
 */
export const getCoupons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await CouponService.listCoupons();

    res.status(200).json({
      success: true,
      message: 'Coupons retrieved successfully',
      data: coupons
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Coupon by Code
 * Admin can check coupon details by code
 */
export const getCouponByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    
    const coupon = await CouponService.getCouponByCode(code);
    if (!coupon) {
      res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Coupon retrieved successfully',
      data: coupon
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Coupon Redemptions
 * Admin can see who redeemed a specific coupon
 */
export const getCouponRedemptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;

    const redemptions = await CouponService.getCouponRedemptions(code);

    res.status(200).json({
      success: true,
      message: 'Redemptions retrieved successfully',
      data: redemptions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke Coupon
 * Admin can disable a coupon to prevent further redemptions
 */
export const revokeCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const coupon = await CouponService.revokeCoupon(code);

    res.status(200).json({
      success: true,
      message: 'Coupon revoked successfully',
      data: coupon
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Coupon
 * Admin can delete a coupon only if it has not been redeemed yet
 */
export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    await CouponService.deleteCoupon(code);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error: any) {
    if (error.message.includes('already been redeemed')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    next(error);
  }
};

/**
 * Get Specific Plan with Full Entitlements (grouped)
 * GET /api/admin/plans/:id/entitlements
 */
export const getPlanEntitlements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Get plan entitlements from DB
    const planEntitlements = await PlanEntitlement.find({ plan_id: plan._id }).lean();

    // Get entitlement definitions for metadata/descriptions
    const entitlementKeys = planEntitlements.map((e: any) => e.entitlement_key);
    const definitions = await EntitlementDefinition.find({
      key: { $in: entitlementKeys },
    }).lean();

    const definitionMap = new Map(definitions.map((d: any) => [d.key, d]));

    // Group entitlements by category (capabilities, limits, etc.)
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

    res.status(200).json({
      success: true,
      data: {
        plan: plan,
        entitlements: groupedEntitlements,
        raw_entitlements: planEntitlements,
      },
    });
  } catch (error) {
    next(error);
  }
};
