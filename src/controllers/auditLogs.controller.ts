import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models';

/**
 * Get All Audit Logs
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, perPage = 20, action, userId } = req.query;

    const filter: any = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;

    const skip = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'name email')
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      data: logs,
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
 * Create Audit Log
 */
export const createAuditLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, action, resource, details, ipAddress, userAgent } = req.body;

    const log = await AuditLog.create({
      userId,
      action,
      resource,
      details,
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      data: log,
      message: 'Audit log created',
    });
  } catch (error) {
    next(error);
  }
};
