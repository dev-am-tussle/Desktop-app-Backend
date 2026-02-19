import { Router } from 'express';
import {
  createFXRate,
  getFXRates,
  updateFXRate,
  deactivateFXRate,
  getCurrentFXRates,
} from '../controllers/fxRates.controller';
import { authenticateAdminToken, requireAdminRole } from '../middleware/auth';

const router = Router();

// ============================================
// PUBLIC ENDPOINT
// ============================================

/**
 * GET /api/fx-rates
 * Get current active FX rates as a simple map
 */
router.get('/', getCurrentFXRates);

// ============================================
// ADMIN PROTECTED ROUTES (Simplified)
// ============================================

/**
 * POST /api/admin/fx-rates/all
 */
router.post(
  '/all',
  authenticateAdminToken,
  requireAdminRole,
  createFXRate
);

/**
 * GET /api/admin/fx-rates/all
 */
router.get(
  '/all',
  // authenticateAdminToken, // TEMPORARILY DISABLED FOR TESTING
  // requireAdminRole,      // TEMPORARILY DISABLED FOR TESTING
  getFXRates
);

/**
 * PUT /api/admin/fx-rates/:id
 */
router.put(
  '/:id',
  authenticateAdminToken,
  requireAdminRole,
  updateFXRate
);

/**
 * DELETE /api/admin/fx-rates/:id
 */
router.delete(
  '/:id',
  authenticateAdminToken,
  requireAdminRole,
  deactivateFXRate
);

export default router;
