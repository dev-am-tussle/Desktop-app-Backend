import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      admin?: {
        adminId: string;
        email: string;
        role: string;
        exp: number;
        iat: number;
      };
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔐 Auth middleware - Token present:', !!token);

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required',
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    console.log('✅ Token decoded:', { userId: decoded.userId, role: decoded.role, email: decoded.email });
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error);
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    console.log('🔒 requireRole middleware called!');
    console.log('📋 Required roles:', allowedRoles);
    console.log('👤 User role:', req.user?.role);
    
    if (!req.user) {
      console.log('❌ No user in request');
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ Role check failed - 403 FORBIDDEN');
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    console.log('✅ Role check passed');
    next();
  };
};

// ============================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ============================================

export const authenticateAdminToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Admin authentication token required',
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Verify token type is admin
    if (decoded.type !== 'admin') {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type. Admin token required',
        },
      });
      return;
    }

    req.admin = {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
      exp: decoded.exp,
      iat: decoded.iat,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired admin token',
      },
    });
  }
};

export const requireAdminRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.admin.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient admin permissions',
        },
      });
      return;
    }

    next();
  };
};
