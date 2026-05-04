import { Router } from 'express';
import * as mcpCredentialsController from '../controllers/mcpCredentials.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { readLimiter, writeLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { body, param } from 'express-validator';

const router = Router();

// ✅ Validation for ADMIN-only credential creation (no userId needed)
const storeCredentialsValidation = [
  body('connectorId')
    .notEmpty()
    .withMessage('Connector ID is required')
    .isMongoId()
    .withMessage('Connector ID must be a valid MongoDB ObjectId'),
  body('credentials')
    .notEmpty()
    .withMessage('Credentials object is required')
    .isObject()
    .withMessage('Credentials must be a JSON object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

const connectorParamValidation = [
  param('connector')
    .notEmpty()
    .withMessage('Connector name is required')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Connector name must be between 1 and 100 characters'),
];

const accessTokenParamValidation = [
  param('accessToken')
    .notEmpty()
    .withMessage('Access token is required')
    .isString()
    .trim(),
];

// ============================================
// ADMIN ROUTES (Create, Update, Delete)
// ============================================

/**
 * POST /mcp/credentials
 * ADMIN ONLY - Store global credentials for a connector
 * Body: { connectorId: string, credentials: object, metadata?: object }
 */
router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  storeCredentialsValidation,
  validate,
  mcpCredentialsController.storeCredentials
);

/**
 * POST /mcp/credentials/:connector/refresh
 * ADMIN ONLY - Refresh access token for existing credentials
 */
router.post(
  '/:connector/refresh',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  connectorParamValidation,
  validate,
  mcpCredentialsController.refreshCredentialsToken
);

/**
 * DELETE /mcp/credentials/:connector
 * ADMIN ONLY - Revoke/delete credentials for a connector
 */
router.delete(
  '/:connector',
  authenticateToken,
  requireRole(['admin']),
  writeLimiter,
  connectorParamValidation,
  validate,
  mcpCredentialsController.deleteCredentials
);

// ============================================
// USER ROUTES (Read only - through access token)
// ============================================

/**
 * GET /mcp/credentials
 * List all available global credentials
 */
router.get(
  '/',
  authenticateToken,
  readLimiter,
  mcpCredentialsController.listCredentials
);

/**
 * GET /mcp/credentials/verify/:accessToken
 * IMPORTANT: Must be BEFORE /:connector route
 * INTERNAL - Verify token and get decrypted credentials
 * Called by Electron app after getting accessToken
 * No authentication required (token is the auth)
 */
router.get(
  '/verify/:accessToken',
  readLimiter,
  accessTokenParamValidation,
  validate,
  mcpCredentialsController.getCredentialsByToken
);

/**
 * GET /mcp/credentials/:connector
 * Get access token for a specific connector
 * Returns short-lived token to retrieve actual credentials
 */
router.get(
  '/:connector',
  authenticateToken,
  readLimiter,
  connectorParamValidation,
  validate,
  mcpCredentialsController.getCredentials
);

export default router;