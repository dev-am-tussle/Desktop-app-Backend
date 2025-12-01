import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { readLimiter, writeLimiter, bulkLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import * as licensesController from '../controllers/licenses.controller';

const router = Router();

// Validation chains
const getLicensesValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'expired', 'revoked']),
  query('userId').optional().isMongoId(),
];

const getLicenseByIdValidation = [param('id').isMongoId().withMessage('Invalid license ID')];

const generateLicenseValidation = [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('userId').optional().isMongoId().withMessage('Valid user ID required'),
  body('seats').optional().isInt({ min: 1, max: 1000 }).withMessage('Seats must be 1-1000'),
  body('expiresAt').optional().isISO8601().toDate(),
];

const assignLicenseValidation = [
  param('id').isMongoId().withMessage('Invalid license ID'),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
];

const revokeLicenseValidation = [
  param('id').isMongoId().withMessage('Invalid license ID'),
];

const bulkGenerateLicensesValidation = [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('count').isInt({ min: 1, max: 100 }).withMessage('Count must be 1-100'),
  body('seats').optional().isInt({ min: 1, max: 1000 }),
  body('expiresAt').optional().isISO8601().toDate(),
];

// Routes
router.get(
  '/',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getLicensesValidation,
  validate,
  licensesController.getLicenses
);

router.get(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getLicenseByIdValidation,
  validate,
  licensesController.getLicenseById
);

router.post(
  '/generate',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  generateLicenseValidation,
  validate,
  licensesController.generateLicense
);

router.put(
  '/:id/assign',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  assignLicenseValidation,
  validate,
  licensesController.assignLicense
);

router.post(
  '/:id/revoke',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  revokeLicenseValidation,
  validate,
  licensesController.revokeLicense
);

router.post(
  '/bulk-generate',
  authenticateToken,
  requireRole(['admin']),
  bulkLimiter,
  bulkGenerateLicensesValidation,
  validate,
  licensesController.bulkGenerateLicenses
);

export default router;
