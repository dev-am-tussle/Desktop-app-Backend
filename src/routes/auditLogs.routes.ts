import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { readLimiter, writeLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { query } from 'express-validator';
import * as auditLogsController from '../controllers/auditLogs.controller';

const router = Router();

// Validation chains
const getAuditLogsValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('action').optional().isString(),
  query('userId').optional().isMongoId(),
];

// Routes
router.get(
  '/',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getAuditLogsValidation,
  validate,
  auditLogsController.getAuditLogs
);

router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  auditLogsController.createAuditLog
);

export default router;
