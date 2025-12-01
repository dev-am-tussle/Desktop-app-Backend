import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { readLimiter, writeLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import * as modelsController from '../controllers/models.controller';

const router = Router();

// Validation chains
const getModelsValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('perPage').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('category').optional().isString().trim(),
  query('status').optional().isString(),
];

const getModelByIdValidation = [param('id').isMongoId().withMessage('Invalid model ID')];

const uploadModelValidation = [
  body('name').notEmpty().trim().withMessage('Model name is required'),
  body('version').notEmpty().trim().withMessage('Version is required'),
  body('category').notEmpty().trim().withMessage('Category is required'),
  body('size').isInt({ min: 0 }).withMessage('Size must be a positive number'),
];

const updateModelValidation = [
  param('id').isMongoId().withMessage('Invalid model ID'),
];

// Routes
router.get(
  '/',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getModelsValidation,
  validate,
  modelsController.getModels
);

router.get(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getModelByIdValidation,
  validate,
  modelsController.getModelById
);

router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  uploadModelValidation,
  validate,
  modelsController.uploadModel
);

router.put(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  updateModelValidation,
  validate,
  modelsController.updateModel
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  getModelByIdValidation,
  validate,
  modelsController.deleteModel
);

router.post(
  '/:modelId/download',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  modelsController.downloadModel
);

export default router;
