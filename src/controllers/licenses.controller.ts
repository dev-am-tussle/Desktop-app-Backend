import { Request, Response, NextFunction } from 'express';
import { License, SubscriptionPlan, User } from '../models';
import { AppError } from '../middleware/errorHandler';
import crypto from 'crypto';

/**
 * Generate License Key
 * Format: XXXX-XXXX-XXXX-XXXX
 */
const generateLicenseKey = (): string => {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
    segments.push(segment);
  }
  return segments.join('-');
};

/**
 * Get All Licenses
 */
export const getLicenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, perPage = 20, status, userId } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const skip = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const [licenses, total] = await Promise.all([
      License.find(filter)
        .populate('userId', 'name email')
        .populate('planId', 'name price currency billingPeriod')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit),
      License.countDocuments(filter),
    ]);

    res.json({
      data: licenses,
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
 * Get License by ID
 */
export const getLicenseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const license = await License.findById(id)
      .populate('userId', 'name email avatar')
      .populate('planId', 'name price currency billingPeriod features');

    if (!license) {
      throw new AppError('License not found', 404, 'LICENSE_NOT_FOUND');
    }

    res.json({ data: license });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate New License
 */
export const generateLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, userId, seats = 1, expiresAt } = req.body;

    // Verify plan exists
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Verify user exists if provided
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
    }

    // Generate unique license key
    let licenseKey = generateLicenseKey();
    let existingLicense = await License.findOne({ key: licenseKey });
    
    // Ensure unique key
    while (existingLicense) {
      licenseKey = generateLicenseKey();
      existingLicense = await License.findOne({ key: licenseKey });
    }

    // Create license
    const license = await License.create({
      key: licenseKey,
      planId,
      userId: userId || null,
      seats,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: 'active',
    });

    const populatedLicense = await License.findById(license._id)
      .populate('userId', 'name email')
      .populate('planId', 'name price currency billingPeriod');

    res.status(201).json({
      data: populatedLicense,
      message: 'License generated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign License to User
 */
export const assignLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const license = await License.findById(id);
    if (!license) {
      throw new AppError('License not found', 404, 'LICENSE_NOT_FOUND');
    }

    if (license.status !== 'active') {
      throw new AppError('Cannot assign inactive license', 400, 'LICENSE_INACTIVE');
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    license.userId = userId;
    await license.save();

    const populatedLicense = await License.findById(license._id)
      .populate('userId', 'name email')
      .populate('planId', 'name price currency billingPeriod');

    res.json({
      data: populatedLicense,
      message: 'License assigned successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke License
 */
export const revokeLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const license = await License.findById(id);
    if (!license) {
      throw new AppError('License not found', 404, 'LICENSE_NOT_FOUND');
    }

    license.status = 'revoked';
    await license.save();

    res.json({
      data: license,
      message: 'License revoked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk Generate Licenses
 */
export const bulkGenerateLicenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, count, seats = 1, expiresAt } = req.body;

    // Verify plan exists
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
    }

    const licenses = [];
    for (let i = 0; i < count; i++) {
      // Generate unique license key
      let licenseKey = generateLicenseKey();
      let existingLicense = await License.findOne({ key: licenseKey });
      
      while (existingLicense) {
        licenseKey = generateLicenseKey();
        existingLicense = await License.findOne({ key: licenseKey });
      }

      licenses.push({
        key: licenseKey,
        planId,
        seats,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: 'active',
      });
    }

    const createdLicenses = await License.insertMany(licenses);

    res.status(201).json({
      data: createdLicenses,
      message: `${count} licenses generated successfully`,
    });
  } catch (error) {
    next(error);
  }
};
