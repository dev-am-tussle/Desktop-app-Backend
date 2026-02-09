import crypto from 'crypto';
import { Types } from 'mongoose';
import User from '../models/User.model';
import SubscriptionPlan from '../models/SubscriptionPlan.model';
import EntitlementDefinition from '../models/EntitlementDefinition.model';
import PlanEntitlement from '../models/PlanEntitlement.model';
import UserEntitlementOverride from '../models/UserEntitlementOverride.model';
import EntitlementCache from '../models/EntitlementCache.model';
import { CouponRedemption } from '../models/CouponRedemption.model';

/**
 * Entitlement Snapshot Structure
 */
export interface EntitlementSnapshot {
  capabilities: Record<string, boolean>;
  limits: Record<string, number | 'unlimited'>;
  resources: Record<string, any[]>;
  deployment: Record<string, any>;
  support: Record<string, any>;
}

/**
 * Full Snapshot with Metadata
 */
export interface FullEntitlementSnapshot {
  user_id: string;
  plan_id: string;
  plan_name: string;
  source: 'stripe' | 'coupon' | 'trial' | 'manual';
  entitlements: EntitlementSnapshot;
  definitions?: Record<string, any[]>;
  issued_at: Date;
  valid_until: Date;
  offline_allowed: boolean;
  signature: string;
}

/**
 * EntitlementsService
 * Core service for generating, caching, and validating user entitlements
 */
class EntitlementsService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'sovereign_ai_secret_key_2025';

  /**
   * Generate HMAC SHA256 signature for snapshot
   */
  private generateSignature(snapshot: EntitlementSnapshot, userId: string, issuedAt: Date): string {
    const payload = JSON.stringify({
      user_id: userId,
      entitlements: snapshot,
      issued_at: issuedAt.toISOString(),
    });
    
    return crypto
      .createHmac('sha256', this.JWT_SECRET)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify snapshot signature
   */
  public verifySignature(
    snapshot: EntitlementSnapshot,
    userId: string,
    issuedAt: Date,
    signature: string
  ): boolean {
    const expectedSignature = this.generateSignature(snapshot, userId, issuedAt);
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  /**
   * Get TTL hours based on plan name
   */
  private getTTLHours(planName: string): number {
    const ttlMap: Record<string, number> = {
      free: 12,
      pro: 48,
      business: 72,
      enterprise: 168,
    };
    return ttlMap[planName.toLowerCase()] || 12;
  }

  /**
   * Resolve user entitlements: plan + overrides
   */
  public async resolveUserEntitlements(userId: string | Types.ObjectId): Promise<FullEntitlementSnapshot> {
    // Fetch user
    const user = await User.findById(userId).populate('plan_id');
    if (!user) {
      throw new Error('User not found');
    }

    // Check subscription status
    if (user.subscription_status === 'expired' || user.subscription_status === 'cancelled') {
      // If expired/cancelled but still in grace period or before subscription_ends_at
      const now = new Date();
      const hasAccess = (user.grace_period_until && user.grace_period_until > now) ||
                        (user.subscription_ends_at && user.subscription_ends_at > now);
      
      if (!hasAccess) {
        // Downgrade to Free plan
        const freePlan = await SubscriptionPlan.findOne({ name: 'free' });
        if (freePlan) {
          user.plan_id = freePlan._id;
        }
      }
    }

    // Get plan (fallback to Free if no plan assigned)
    let plan = user.plan_id as any;
    if (!plan || typeof plan === 'string') {
      const freePlan = await SubscriptionPlan.findOne({ name: 'free' });
      if (!freePlan) {
        throw new Error('No default Free plan found. Please seed database.');
      }
      plan = freePlan;
    }

    // Fetch all entitlement definitions
    const definitions = await EntitlementDefinition.find({});

    // Group definitions by category for the response
    const groupedDefinitions: Record<string, any[]> = {
      capabilities: [],
      limits: [],
      resources: [],
      deployment: [],
      support: [],
    };

    definitions.forEach(def => {
      if (groupedDefinitions[def.category]) {
        groupedDefinitions[def.category].push({
          key: def.key,
          type: def.type,
          description: def.description,
          default_value: def.default_value,
        });
      }
    });

    // Fetch plan entitlements
    const planEntitlements = await PlanEntitlement.find({ plan_id: plan._id });
    const planEntitlementMap = new Map(planEntitlements.map(e => [e.entitlement_key, e.value]));

    // Fetch user overrides (not expired)
    const now = new Date();
    const overrides = await UserEntitlementOverride.find({
      user_id: userId,
      $or: [{ expires_at: { $exists: false } }, { expires_at: { $gt: now } }],
    });
    const overrideMap = new Map(overrides.map(o => [o.entitlement_key, o.value]));

    // Build merged snapshot
    const snapshot: EntitlementSnapshot = {
      capabilities: {},
      limits: {},
      resources: {},
      deployment: {},
      support: {},
    };

    // Process all definitions
    for (const def of definitions) {
      let value = def.default_value;

      // Override priority: user override > plan entitlement > default
      if (overrideMap.has(def.key)) {
        value = overrideMap.get(def.key);
      } else if (planEntitlementMap.has(def.key)) {
        value = planEntitlementMap.get(def.key);
      }

      // Map to correct category
      switch (def.category) {
        case 'capabilities':
          snapshot.capabilities[def.key] = Boolean(value);
          break;
        case 'limits':
          snapshot.limits[def.key] = value as number | 'unlimited';
          break;
        case 'resources':
          snapshot.resources[def.key] = Array.isArray(value) ? value : [];
          break;
        case 'deployment':
          snapshot.deployment[def.key] = value;
          break;
        case 'support':
          snapshot.support[def.key] = value;
          break;
      }
    }

    // Generate signature and metadata
    const issuedAt = new Date();
    const ttlHours = this.getTTLHours(plan.name);
    const validUntil = new Date(issuedAt.getTime() + ttlHours * 60 * 60 * 1000);
    const signature = this.generateSignature(snapshot, user._id.toString(), issuedAt);

    // Determine subscription source
    let subscriptionSource: 'stripe' | 'coupon' | 'trial';
    let finalPlanId = plan._id.toString();
    let finalPlanName = plan.name;

    if (user.stripeSubscriptionId) {
      subscriptionSource = 'stripe';
    } else if (user.subscription_status === 'active' && !user.stripeSubscriptionId) {
      subscriptionSource = 'coupon';
      // If it's a coupon, try to get the coupon ID for plan_id and set name to "coupon"
      const lastRedemption = await CouponRedemption.findOne({ user_id: user._id }).sort({ redeemed_at: -1 });
      if (lastRedemption) {
        finalPlanId = lastRedemption.coupon_id.toString();
        finalPlanName = 'coupon';
      }
    } else {
      subscriptionSource = 'trial';
    }

    const fullSnapshot: FullEntitlementSnapshot = {
      user_id: user._id.toString(),
      plan_id: finalPlanId,
      plan_name: finalPlanName,
      source: subscriptionSource,
      entitlements: snapshot,
      definitions: groupedDefinitions,
      issued_at: issuedAt,
      valid_until: validUntil,
      offline_allowed: snapshot.deployment.mode === 'hybrid' || snapshot.deployment.mode === 'local',
      signature,
    };

    // Cache snapshot in database
    await EntitlementCache.create({
      user_id: user._id,
      plan_id: finalPlanId, // Store the overridden ID
      source: subscriptionSource,
      snapshot,
      signature,
      issued_at: issuedAt,
      valid_until: validUntil,
      client_synced: false,
      revoked: false,
    });

    // Update user's last sync time
    user.last_entitlement_sync = issuedAt;
    await user.save();

    return fullSnapshot;
  }

  /**
   * Get cached entitlement snapshot (if valid)
   */
  public async getCachedEntitlements(userId: string | Types.ObjectId): Promise<FullEntitlementSnapshot | null> {
    const cache = await EntitlementCache.findOne({
      user_id: userId,
      revoked: false,
      valid_until: { $gt: new Date() },
    })
      .sort({ issued_at: -1 })
      .populate('plan_id');

    if (!cache) {
      return null;
    }

    const plan = cache.plan_id as any;
    const source = (cache.source || 'trial') as any;
    
    // Fetch and group definitions for consistent response
    const definitions = await EntitlementDefinition.find({});
    const groupedDefinitions: Record<string, any[]> = {
      capabilities: [],
      limits: [],
      resources: [],
      deployment: [],
      support: [],
    };

    definitions.forEach(def => {
      if (groupedDefinitions[def.category]) {
        groupedDefinitions[def.category].push({
          key: def.key,
          type: def.type,
          description: def.description,
          default_value: def.default_value,
        });
      }
    });

    return {
      user_id: cache.user_id.toString(),
      plan_id: cache.plan_id.toString(),
      plan_name: source === 'coupon' ? 'coupon' : (plan?.name || 'unknown'),
      source: source,
      entitlements: cache.snapshot as EntitlementSnapshot,
      definitions: groupedDefinitions,
      issued_at: cache.issued_at,
      valid_until: cache.valid_until,
      offline_allowed: (cache.snapshot as any).deployment?.mode === 'hybrid' || (cache.snapshot as any).deployment?.mode === 'local',
      signature: cache.signature,
    };
  }

  /**
   * Revoke all cached entitlements for a user (e.g., on plan change)
   */
  public async revokeAllCaches(userId: string | Types.ObjectId): Promise<void> {
    await EntitlementCache.updateMany({ user_id: userId }, { revoked: true });
  }

  /**
   * Check if user has a specific capability
   */
  public async canPerformAction(userId: string | Types.ObjectId, capability: string): Promise<boolean> {
    // Try cached first
    let snapshot = await this.getCachedEntitlements(userId);
    
    // If no valid cache, generate new snapshot
    if (!snapshot) {
      snapshot = await this.resolveUserEntitlements(userId);
    }

    return snapshot.entitlements.capabilities[capability] === true;
  }

  /**
   * Check if user is within limit
   */
  public async checkLimit(
    userId: string | Types.ObjectId,
    limitKey: string,
    currentUsage: number
  ): Promise<{ allowed: boolean; limit: number | 'unlimited'; remaining: number | 'unlimited' }> {
    // Try cached first
    let snapshot = await this.getCachedEntitlements(userId);
    
    // If no valid cache, generate new snapshot
    if (!snapshot) {
      snapshot = await this.resolveUserEntitlements(userId);
    }

    const limit = snapshot.entitlements.limits[limitKey];
    
    if (limit === 'unlimited') {
      return { allowed: true, limit: 'unlimited', remaining: 'unlimited' };
    }

    const numLimit = Number(limit);
    const allowed = currentUsage < numLimit;
    const remaining = Math.max(0, numLimit - currentUsage);

    return { allowed, limit: numLimit, remaining };
  }

  /**
   * Check if user can access a specific resource
   */
  public async canAccessResource(
    userId: string | Types.ObjectId,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    // Try cached first
    let snapshot = await this.getCachedEntitlements(userId);
    
    // If no valid cache, generate new snapshot
    if (!snapshot) {
      snapshot = await this.resolveUserEntitlements(userId);
    }

    const allowedResources = snapshot.entitlements.resources[resourceType];
    
    if (!allowedResources || !Array.isArray(allowedResources)) {
      return false;
    }

    // If array contains "unlimited" or "*", allow all
    if (allowedResources.includes('unlimited') || allowedResources.includes('*')) {
      return true;
    }

    return allowedResources.includes(resourceId);
  }

  /**
   * Get current usage for a limit (stub - implement based on your usage tracking)
   */
  public async getCurrentUsage(_userId: string | Types.ObjectId, _limitKey: string): Promise<number> {
    // TODO: Implement usage tracking based on your needs
    // Example: Count conversations created today, files uploaded today, etc.
    // For now, return 0
    return 0;
  }
}

export default new EntitlementsService();
