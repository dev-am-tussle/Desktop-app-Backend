import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * EntitlementCache Model
 * Stores generated entitlement snapshots for:
 * - Audit trail (what access did user have at what time)
 * - Offline recovery (if local cache corrupted)
 * - Debugging (snapshot history)
 */

export interface IEntitlementCache extends Document {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  plan_id: mongoose.Types.ObjectId;
  snapshot: Record<string, any>;     // Full resolved entitlements
  signature: string;                 // HMAC signature for tampering protection
  issued_at: Date;
  valid_until: Date;
  client_synced: boolean;            // Did client download this snapshot?
  revoked: boolean;                  // Invalidate old snapshots
  created_at: Date;
}

const EntitlementCacheSchema: Schema<IEntitlementCache> = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: [true, 'Plan ID is required'],
    },
    snapshot: {
      type: Schema.Types.Mixed,
      required: [true, 'Snapshot is required'],
    },
    signature: {
      type: String,
      required: [true, 'Signature is required'],
    },
    issued_at: {
      type: Date,
      required: [true, 'Issued at is required'],
      index: true,
    },
    valid_until: {
      type: Date,
      required: [true, 'Valid until is required'],
      index: true,
    },
    client_synced: {
      type: Boolean,
      default: false,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: function (_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for fast lookups
EntitlementCacheSchema.index({ user_id: 1, issued_at: -1 });
EntitlementCacheSchema.index({ user_id: 1, revoked: 1, issued_at: -1 });

// TTL index - auto-delete old snapshots after 90 days (audit retention)
EntitlementCacheSchema.index({ created_at: 1 }, { expireAfterSeconds: 7776000 });

const EntitlementCache: Model<IEntitlementCache> = 
  mongoose.model<IEntitlementCache>('EntitlementCache', EntitlementCacheSchema);

export default EntitlementCache;
