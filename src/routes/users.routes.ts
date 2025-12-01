import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { readLimiter, writeLimiter, bulkLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Validation chains
const getUsersValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim(),
  query('role').optional().isIn(['user', 'admin', 'support']),
  query('status').optional().isIn(['active', 'disabled', 'pending']),
];

const getUserByIdValidation = [param('id').isMongoId().withMessage('Invalid user ID')];

const createUserValidation = [
  body('name').notEmpty().isString().trim().isLength({ min: 1, max: 100 }),
  body('email').notEmpty().isEmail().normalizeEmail().isLength({ max: 255 }),
  body('password').notEmpty().isString().isLength({ min: 8 }),
  body('role').optional().isIn(['user', 'admin', 'support']),
  body('status').optional().isIn(['active', 'disabled', 'pending']),
];

const updateUserValidation = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail().normalizeEmail().isLength({ max: 255 }),
  body('role').optional().isIn(['user', 'admin', 'support']),
  body('status').optional().isIn(['active', 'disabled', 'pending']),
  body('tags').optional().isArray(),
  body('preferences').optional().isObject(),
];

const deleteUserValidation = [param('id').isMongoId().withMessage('Invalid user ID')];

const impersonateUserValidation = [param('id').isMongoId().withMessage('Invalid user ID')];

const bulkDisableUsersValidation = [
  body('userIds').isArray().notEmpty().withMessage('User IDs array is required'),
];

// Routes
router.get(
  '/',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getUsersValidation,
  validate,
  usersController.getUsers
);

router.get(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  readLimiter,
  getUserByIdValidation,
  validate,
  usersController.getUserById
);

router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  createUserValidation,
  validate,
  usersController.createUser
);

router.put(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  updateUserValidation,
  validate,
  usersController.updateUser
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  deleteUserValidation,
  validate,
  usersController.deleteUser
);

router.post(
  '/:id/impersonate',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  impersonateUserValidation,
  validate,
  usersController.impersonateUser
);

router.post(
  '/bulk-disable',
  authenticateToken,
  requireRole(['admin']),
  bulkLimiter,
  bulkDisableUsersValidation,
  validate,
  usersController.bulkDisableUsers
);

export default router;
