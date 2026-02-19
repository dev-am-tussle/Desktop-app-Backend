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
 * Create Plan with Entitlements (MULTI-CURRENCY)
 * POST /api/admin/plans/create-with-entitlements
 * Creates a subscription plan with multi-currency pricing and assigns entitlements
 * 
 * NEW PAYLOAD STRUCTURE:
 * {
 *   "plan": {
 *     "name": "pro",
 *     "display_name": "Pro Plan",
 *     "slug": "pro-plan",
 *     "base_amount_monthly": 1999,    // AUD in cents
 *     "base_amount_yearly": 19999,
 *     "target_regions": [
 *       { "currency": "AUD", "custom_amount_monthly": 1999 },
 *       { "currency": "USD" },  // Will auto-convert
 *       { "currency": "INR", "custom_amount_monthly": 129900 }
 *     ],
 *     "features": [...],
 *     "category": "personal",
 *     "is_contact_sales": false
 *   },
 *   "entitlements": [...]
 * }
 */
export const createPlanWithEntitlements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { plan: planPayload, entitlements } = req.body;

    // ============ PAYLOAD NORMALIZATION ============
    // If frontend sends "prices" object (new structure), convert it to service structure
    if (planPayload && planPayload.prices) {
      const prices = planPayload.prices;
      
      // 1. Find Base Amount (Look for is_base: true or default to AUD)
      const monthlyPrices = prices.monthly || {};
      const yearlyPrices = prices.yearly || {};
      
      const baseCurrency = Object.keys(monthlyPrices).find(curr => monthlyPrices[curr].is_base) || 'AUD';
      
      planPayload.base_amount_monthly = monthlyPrices[baseCurrency]?.amount || 0;
      planPayload.base_amount_yearly = yearlyPrices[baseCurrency]?.amount || undefined;
      
      // 2. Generate Target Regions
      if (!planPayload.target_regions) {
        planPayload.target_regions = Object.keys(monthlyPrices).map(currency => ({
          currency,
          custom_amount_monthly: monthlyPrices[currency].amount,
          custom_amount_yearly: yearlyPrices[currency]?.amount
        }));
      }
    }

    // ============ VALIDATION ============
    if (!planPayload) {
      throw new AppError('Plan details are required', 400, 'INVALID_PAYLOAD');
    }

    // Import the service here to avoid circular dependency
    const {
      validateCreatePlanPayload,
      generatePriceBreakdown,
      createStripePrices,
      generatePricingMetadata,
    } = await import('../services/priceConversion.service');

    // Validate admin payload
    const validation = await validateCreatePlanPayload(planPayload);
    if (!validation.valid) {
      throw new AppError(`Validation failed: ${validation.errors.join('; ')}`, 400, 'VALIDATION_FAILED');
    }

    // Check for duplicate plan
    const existingPlan = await SubscriptionPlan.findOne({
      $or: [{ name: planPayload.name }, { slug: planPayload.slug }],
    });
    if (existingPlan) {
      throw new AppError('A plan with this name or slug already exists', 400, 'DUPLICATE_PLAN');
    }

    // ============ GENERATE PRICING ============
    console.log('💰 Generating multi-currency pricing...');
    const { breakdown, warnings } = await generatePriceBreakdown(planPayload);
    
    if (warnings.length > 0) {
      console.warn('⚠️  Pricing warnings:', warnings);
    }

    const supportedCurrencies = breakdown.map(b => b.currency);
    console.log(`✅ Generated prices for: ${supportedCurrencies.join(', ')}`);

    // ============ CREATE STRIPE PRODUCT ============
    let stripeProductId = null;
    let stripePriceIds: { monthly: Record<string, string>; yearly: Record<string, string> } = { 
      monthly: {}, 
      yearly: {} 
    };
    let stripeErrors: { currency: string; error: string }[] = [];

    if (!planPayload.is_contact_sales) {
      console.log('🔵 Creating Stripe Product...');
      const stripeProduct = await stripeService.createStripeProduct({
        name: planPayload.display_name,
        description: planPayload.description || `${planPayload.display_name} Subscription`,
      });
      stripeProductId = stripeProduct.id;
      console.log(`✅ Stripe Product created: ${stripeProductId}`);

      // ============ CREATE STRIPE PRICES (MULTI-CURRENCY) ============
      console.log(`🔵 Creating Stripe prices for ${supportedCurrencies.length} currencies...`);
      const priceCreationResult = await createStripePrices(stripeProductId, breakdown);
      stripePriceIds = {
        monthly: priceCreationResult.monthly,
        yearly: priceCreationResult.yearly || {},
      };
      stripeErrors = priceCreationResult.errors;

      const successCount = Object.keys(priceCreationResult.monthly).length;
      console.log(`✅ Created ${successCount} Stripe prices`);

      if (stripeErrors.length > 0) {
        console.warn(`⚠️  Failed to create prices for: ${stripeErrors.map(e => e.currency).join(', ')}`);
      }
    } else {
      console.log('⏭️  Skipping Stripe integration (contact sales plan)');
    }

    // ============ BUILD PRICES OBJECT ============
    const pricesObject: any = {
      monthly: {},
    };

    for (const pricing of breakdown) {
      pricesObject.monthly[pricing.currency] = {
        amount: pricing.monthly.amount,
        stripe_price_id: stripePriceIds.monthly[pricing.currency] || null,
        source: pricing.monthly.source,
      };

      if (pricing.yearly) {
        if (!pricesObject.yearly) pricesObject.yearly = {};
        pricesObject.yearly[pricing.currency] = {
          amount: pricing.yearly.amount,
          stripe_price_id: stripePriceIds.yearly[pricing.currency] || null,
          source: pricing.yearly.source,
        };
      }
    }

    // ============ CREATE PLAN IN DATABASE ============
    console.log('📋 Creating subscription plan in database...');
    const newPlan = await SubscriptionPlan.create({
      name: planPayload.name,
      display_name: planPayload.display_name,
      slug: planPayload.slug,
      description: planPayload.description || '',
      features: planPayload.features || [],
      category: planPayload.category || 'personal',
      
      // Multi-currency structure (REQUIRED)
      prices: pricesObject,
      pricing_metadata: generatePricingMetadata(planPayload, supportedCurrencies),
      
      is_contact_sales: planPayload.is_contact_sales || false,
      status: 'active',
      sort_order: planPayload.sort_order || 0,
      stripe_product_id: stripeProductId,
    });
    console.log(`✅ Plan created: ${newPlan.display_name} (ID: ${newPlan._id})`);

    // ============ CREATE ENTITLEMENTS ============
    let planEntitlements: any[] = [];
    let entitlementSummary = { total: 0, created: 0, failed: 0 };

    if (entitlements && Array.isArray(entitlements)) {
      console.log(`📋 Creating ${entitlements.length} entitlements...`);
      entitlementSummary.total = entitlements.length;

      for (const ent of entitlements) {
        try {
          const definition = await EntitlementDefinition.findOne({ key: ent.entitlement_key });
          if (!definition) {
            console.warn(`⚠️  Entitlement not found: ${ent.entitlement_key}`);
            entitlementSummary.failed++;
            continue;
          }

          const planEntitlement = await PlanEntitlement.create({
            plan_id: newPlan._id,
            entitlement_key: ent.entitlement_key,
            value: ent.value,
          });
          planEntitlements.push(planEntitlement);
          entitlementSummary.created++;
        } catch (error: any) {
          console.error(`❌ Error creating entitlement ${ent.entitlement_key}:`, error.message);
          entitlementSummary.failed++;
        }
      }
      console.log(`✅ Entitlements: ${entitlementSummary.created} created, ${entitlementSummary.failed} failed`);
    }

    // ============ RESPONSE ============
    res.status(201).json({
      success: true,
      message: 'Plan with multi-currency pricing created successfully',
      data: {
        plan: {
          id: newPlan._id,
          name: newPlan.name,
          display_name: newPlan.display_name,
          slug: newPlan.slug,
          prices: newPlan.prices,
          pricing_metadata: newPlan.pricing_metadata,
          stripe_product_id: newPlan.stripe_product_id,
          stripe_prices_created: Object.keys(stripePriceIds.monthly).length,
          status: newPlan.status,
        },
        pricing_breakdown: breakdown,
        entitlements: {
          summary: entitlementSummary,
          created: planEntitlements,
        },
        warnings: [...warnings, ...stripeErrors.map(e => `${e.currency}: ${e.error}`)],
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
