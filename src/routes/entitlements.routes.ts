import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  syncEntitlements,
  getEntitlements,
  validateCapability,
  checkLimit,
  verifySnapshot,
} from '../controllers/entitlements.controller';

const router = Router();

/**
 * POST /api/entitlements/sync
 * Force regenerate entitlement snapshot
 */
router.post('/sync', authenticateToken, syncEntitlements);

/**
 * GET /api/entitlements
 * Get current entitlement snapshot (cached or fresh)
 */
router.get('/', authenticateToken, getEntitlements);

/**
 * GET /api/entitlements/validate/:capability
 * Check if user has specific capability
 */
router.get('/validate/:capability', authenticateToken, validateCapability);

/**
 * GET /api/entitlements/check-limit/:limitKey
 * Check limit availability (requires ?currentUsage query param)
 */
router.get('/check-limit/:limitKey', authenticateToken, checkLimit);

/**
 * POST /api/entitlements/verify
 * Verify snapshot signature (for client-side validation)
 */
router.post('/verify', verifySnapshot);

export default router;
