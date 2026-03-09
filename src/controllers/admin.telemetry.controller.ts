import { Request, Response, NextFunction } from 'express';
import { UserTelemetry, User } from '../models';
import { AppError } from '../middleware/errorHandler';

/**
 * Get User Telemetry (Admin Only)
 * GET /api/admin/users/:id/telemetry
 */
export const getUserTelemetry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: userId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    // 1. Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // 2. Fetch telemetry records sorted by newest first
    const skip = (Number(page) - 1) * Number(limit);
    
    const [telemetryRecords, total] = await Promise.all([
      UserTelemetry.find({ user_id: userId })
        .sort({ global_ts: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      UserTelemetry.countDocuments({ user_id: userId })
    ]);

    // 3. Return response with metadata
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          onboardingPhase: user.onboardingPhase,
          last_telemetry_sync: (user as any).last_telemetry_sync
        },
        telemetry: telemetryRecords,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};

/**
 * Get Latest Telemetry Snapshot for a user
 * GET /api/admin/users/:id/telemetry/latest
 */
export const getLatestUserTelemetry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: userId } = req.params;

    const latest = await UserTelemetry.findOne({ user_id: userId })
      .sort({ global_ts: -1 })
      .lean();

    if (!latest) {
      return res.json({
        success: true,
        data: null,
        message: 'No telemetry data found for this user'
      });
    }

    res.json({
      success: true,
      data: latest
    });
    return; // Added return to ensure all code paths return a value
  } catch (error) {
    return next(error);
  }
};
