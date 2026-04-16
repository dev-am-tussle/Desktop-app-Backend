import { Router } from 'express';
import { 
  getMarketplaceConnectors, 
  getConnectorById,
  createConnector,
  updateConnector,
  deleteConnector
} from '../controllers/mcpMarketplace.controller';
import { authenticateAdminToken, authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================
// USER MARKETPLACE ROUTES (v1/marketplace)
// ============================================

/**
 * GET /v1/marketplace/connectors
 * Fetch available connectors for the Electron app
 */
router.get('/connectors', readLimiter, authenticateToken, getMarketplaceConnectors);

/**
 * GET /v1/marketplace/connectors/:id
 * Fetch details for a specific connector
 */
router.get('/connectors/:id', readLimiter, authenticateToken, getConnectorById);

// ============================================
// ADMIN MARKETPLACE ROUTES (Create, Update, Delete)
// ============================================

/**
 * POST /connectors
 * Add a new connector to the registry (Admin only)
 */
router.post(
  '/connectors',
  writeLimiter,
  authenticateAdminToken,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('iconUrl').isURL().withMessage('Valid Icon URL is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('runtime.engine').isIn(['npx', 'node', 'python', 'docker', 'exe']).withMessage('Invalid engine type'),
    body('permissions').isArray().withMessage('Permissions must be an array'),
  ],
  validate,
  createConnector
);

/**
 * PUT /connectors/:id
 * Update an existing connector (Admin only)
 */
router.put(
  '/connectors/:id',
  writeLimiter,
  authenticateAdminToken,
  validate,
  updateConnector
);

/**
 * DELETE /connectors/:id
 * Remove/Archive a connector (Admin only)
 */
router.delete(
  '/connectors/:id',
  writeLimiter,
  authenticateAdminToken,
  deleteConnector
);

export default router;
