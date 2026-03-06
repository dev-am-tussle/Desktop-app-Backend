import { Request, Response } from 'express';
import entitlementsService from '../services/entitlements.service';
import EntitlementDefinition from '../models/EntitlementDefinition.model';
import { User } from '../models';
import { getSubscriptionDetails } from '../utils/userHelpers';
import * as telemetryController from './telemetry.controller';

/**
 * Sync/Regenerate entitlement snapshot
 * POST /api/entitlements/sync
 */
export const syncEntitlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { payload, telemetry } = req.body; // Check both keys for flexibility
    const telemetryData = payload || telemetry;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Process Telemetry Sync (Optional) - Call from Entitlements Poll
    // If payload/telemetry object exists in body, we save it to the separate collection
    if (telemetryData) {
      await telemetryController.syncUserTelemetry(userId, telemetryData);
    }

    // Revoke old caches and generate fresh snapshot
    await entitlementsService.revokeAllCaches(userId);
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const subscriptionDetails = await getSubscriptionDetails(user);

    res.status(200).json({
      message: 'Entitlements synced successfully',
      data: subscriptionDetails,
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

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const subscriptionDetails = await getSubscriptionDetails(user);

    res.status(200).json({
      message: 'Entitlements retrieved successfully',
      data: subscriptionDetails,
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

/**
 * Get All Entitlement Definitions
 * GET /api/entitlements/definitions
 * Returns all available entitlement definitions for frontend/admin use
 */
export const getEntitlementDefinitions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, type } = req.query;

    // Build filter
    const filter: any = {};
    if (category) filter.category = category;
    if (type) filter.type = type;

    const definitions = await EntitlementDefinition.find(filter).sort({ category: 1, key: 1 });

    // Group by category for easier frontend consumption
    const groupedDefinitions: any = {
      capabilities: [],
      limits: [],
      resources: [],
      deployment: [],
      support: [],
    };

    definitions.forEach((def: any) => {
      if (groupedDefinitions[def.category]) {
        groupedDefinitions[def.category].push({
          id: def._id,
          key: def.key,
          type: def.type,
          category: def.category,
          description: def.description,
          default_value: def.default_value,
          validation_rules: def.validation_rules,
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        total: definitions.length,
        definitions,
        grouped: groupedDefinitions,
        categories: Object.keys(groupedDefinitions),
      },
    });
  } catch (error: any) {
    console.error('Error fetching entitlement definitions:', error);
    res.status(500).json({
      error: 'Failed to fetch entitlement definitions',
      details: error.message,
    });
  }
};