import { Request, Response, NextFunction } from 'express';
import entitlementsService from '../services/entitlements.service';
import { AppError } from './errorHandler';

/**
 * Middleware: Require specific capability
 * Usage: requireCapability('features.compare_mode')
 */
export const requireCapability = (capability: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const hasCapability = await entitlementsService.canPerformAction(userId, capability);

      if (!hasCapability) {
        throw new AppError(
          `This feature requires the '${capability}' capability. Please upgrade your plan.`,
          403,
          'CAPABILITY_REQUIRED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware: Check limit before proceeding
 * Usage: checkLimit('limits.file_uploads_per_day')
 * Requires req.body.currentUsage or will fetch from service
 */
export const checkLimit = (limitKey: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Get current usage from request or service
      const currentUsage = req.body.currentUsage || 
                          await entitlementsService.getCurrentUsage(userId, limitKey);

      const result = await entitlementsService.checkLimit(userId, limitKey, currentUsage);

      if (!result.allowed) {
        throw new AppError(
          `Limit reached for '${limitKey}'. Your limit is ${result.limit}. Please upgrade your plan.`,
          403,
          'LIMIT_EXCEEDED'
        );
      }

      // Attach remaining to request for controller use
      (req as any).limitRemaining = result.remaining;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware: Require specific resource access
 * Usage: requireResource('models.local.allowed', modelId)
 * Model ID comes from req.params.modelId or req.body.modelId
 */
export const requireResource = (resourceType: string, resourceIdField: string = 'modelId') => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      // Get resource ID from params or body
      const resourceId = req.params[resourceIdField] || req.body[resourceIdField];

      if (!resourceId) {
        throw new AppError(
          `Resource ID '${resourceIdField}' is required`,
          400,
          'RESOURCE_ID_REQUIRED'
        );
      }

      const hasAccess = await entitlementsService.canAccessResource(userId, resourceType, resourceId);

      if (!hasAccess) {
        throw new AppError(
          `Access denied to resource '${resourceId}' in '${resourceType}'. Please check your plan.`,
          403,
          'RESOURCE_ACCESS_DENIED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware: Check file upload entitlements
 * Validates file size and daily upload count
 */
export const checkFileUpload = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Get entitlements snapshot
    let snapshot = await entitlementsService.getCachedEntitlements(userId);
    if (!snapshot) {
      snapshot = await entitlementsService.resolveUserEntitlements(userId);
    }

    // Check if file upload is enabled
    const fileUploadEnabled = snapshot.entitlements.capabilities['features.file_upload'];
    if (!fileUploadEnabled) {
      throw new AppError(
        'File upload is not enabled for your plan',
        403,
        'FILE_UPLOAD_DISABLED'
      );
    }

    // Get file size from request (assuming multer or similar)
    const fileSize = (req as any).file?.size || req.body.fileSize || 0;
    const fileSizeMB = fileSize / (1024 * 1024);

    // Check file size limit
    const maxFileSizeMB = snapshot.entitlements.limits['limits.file_size_mb'];
    if (maxFileSizeMB !== 'unlimited' && fileSizeMB > maxFileSizeMB) {
      throw new AppError(
        `File size exceeds limit. Maximum allowed: ${maxFileSizeMB}MB`,
        403,
        'FILE_SIZE_EXCEEDED'
      );
    }

    // Check daily upload count
    const dailyLimit = snapshot.entitlements.limits['limits.file_uploads_per_day'];
    if (dailyLimit !== 'unlimited') {
      const currentUsage = await entitlementsService.getCurrentUsage(userId, 'limits.file_uploads_per_day');
      
      if (currentUsage >= dailyLimit) {
        throw new AppError(
          `Daily file upload limit reached. Maximum: ${dailyLimit} files per day`,
          403,
          'DAILY_UPLOAD_LIMIT_EXCEEDED'
        );
      }
    }

    // Attach entitlements to request for controller use
    (req as any).entitlements = snapshot.entitlements;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Check model selection entitlements
 * Validates if user can use local or API models
 */
export const checkModelAccess = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { modelId, modelType } = req.body; // modelType: 'local' | 'api'

    if (!modelId || !modelType) {
      throw new AppError('Model ID and type are required', 400, 'MODEL_INFO_REQUIRED');
    }

    // Get entitlements snapshot
    let snapshot = await entitlementsService.getCachedEntitlements(userId);
    if (!snapshot) {
      snapshot = await entitlementsService.resolveUserEntitlements(userId);
    }

    // Check allowed models based on type
    const resourceKey = modelType === 'local' ? 'models.local.allowed' : 'models.api.allowed';
    const allowedModels = snapshot.entitlements.resources[resourceKey] || [];

    // If unlimited or wildcard, allow all
    if (allowedModels.includes('unlimited') || allowedModels.includes('*')) {
      next();
      return;
    }

    // Check if specific model is allowed
    if (!allowedModels.includes(modelId)) {
      throw new AppError(
        `Model '${modelId}' is not available in your plan`,
        403,
        'MODEL_NOT_ALLOWED'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Attach entitlements to request
 * Useful for controllers that need to check multiple entitlements
 */
export const attachEntitlements = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      next();
      return;
    }

    // Get cached or generate new snapshot
    let snapshot = await entitlementsService.getCachedEntitlements(userId);
    if (!snapshot) {
      snapshot = await entitlementsService.resolveUserEntitlements(userId);
    }

    // Attach to request
    (req as any).entitlements = snapshot.entitlements;
    (req as any).entitlementMeta = {
      issued_at: snapshot.issued_at,
      valid_until: snapshot.valid_until,
      plan_name: snapshot.plan_name,
    };

    next();
  } catch (error) {
    console.warn('Failed to attach entitlements:', error);
    next(); // Continue even if entitlements fail
  }
};
