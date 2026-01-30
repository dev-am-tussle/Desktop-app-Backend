import { Request, Response } from 'express';
import entitlementsService from '../services/entitlements.service';

/**
 * Sync/Regenerate entitlement snapshot
 * POST /api/entitlements/sync
 */
export const syncEntitlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Revoke old caches and generate fresh snapshot
    await entitlementsService.revokeAllCaches(userId);
    const snapshot = await entitlementsService.resolveUserEntitlements(userId);

    res.status(200).json({
      message: 'Entitlements synced successfully',
      data: snapshot,
    });
  } catch (error: any) {
    console.error('Error syncing entitlements:', error);
    res.status(500).json({
      error: 'Failed to sync entitlements',
      details: error.message,
    });
  }
};

/**
 * Get current entitlement snapshot
 * GET /api/entitlements
 */
export const getEntitlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Try cached first, fallback to regenerate
    let snapshot = await entitlementsService.getCachedEntitlements(userId);
    
    if (!snapshot) {
      snapshot = await entitlementsService.resolveUserEntitlements(userId);
    }

    res.status(200).json({
      message: 'Entitlements retrieved successfully',
      data: snapshot,
    });
  } catch (error: any) {
    console.error('Error fetching entitlements:', error);
    res.status(500).json({
      error: 'Failed to fetch entitlements',
      details: error.message,
    });
  }
};

/**
 * Validate specific capability
 * GET /api/entitlements/validate/:capability
 */
export const validateCapability = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { capability } = req.params;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hasCapability = await entitlementsService.canPerformAction(userId, capability);

    res.status(200).json({
      capability,
      allowed: hasCapability,
    });
  } catch (error: any) {
    console.error('Error validating capability:', error);
    res.status(500).json({
      error: 'Failed to validate capability',
      details: error.message,
    });
  }
};

/**
 * Check limit availability
 * GET /api/entitlements/check-limit/:limitKey
 */
export const checkLimit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { limitKey } = req.params;
    const { currentUsage } = req.query;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const usage = currentUsage ? parseInt(currentUsage as string, 10) : 0;
    const result = await entitlementsService.checkLimit(userId, limitKey, usage);

    res.status(200).json({
      limitKey,
      ...result,
    });
  } catch (error: any) {
    console.error('Error checking limit:', error);
    res.status(500).json({
      error: 'Failed to check limit',
      details: error.message,
    });
  }
};

/**
 * Verify snapshot signature
 * POST /api/entitlements/verify
 */
export const verifySnapshot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { snapshot, userId, issuedAt, signature } = req.body;
    
    if (!snapshot || !userId || !issuedAt || !signature) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const isValid = entitlementsService.verifySignature(
      snapshot,
      userId,
      new Date(issuedAt),
      signature
    );

    res.status(200).json({
      valid: isValid,
      message: isValid ? 'Signature valid' : 'Signature invalid or tampered',
    });
  } catch (error: any) {
    console.error('Error verifying snapshot:', error);
    res.status(500).json({
      error: 'Failed to verify snapshot',
      details: error.message,
    });
  }
};
