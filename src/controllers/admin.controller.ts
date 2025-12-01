import { Request, Response, NextFunction } from 'express';
import { Admin } from '../models';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';

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
