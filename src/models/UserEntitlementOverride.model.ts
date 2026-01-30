import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * UserEntitlementOverride Model
 * For special cases - enterprise custom deals, temporary unlocks, beta features
 * Overrides the plan's default entitlements for specific users
 */

export interface IUserEntitlementOverride extends Document {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  entitlement_key: string;
  value: any;
  reason?: string;                   // "Enterprise custom deal", "Beta tester access"
  expires_at?: Date;                 // Optional: temporary override
  created_by: mongoose.Types.ObjectId; // Admin who granted
  created_at: Date;
  updated_at: Date;
}

const UserEntitlementOverrideSchema: Schema<IUserEntitlementOverride> = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    entitlement_key: {
      type: String,
      required: [true, 'Entitlement key is required'],
      lowercase: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: [true, 'Value is required'],
    },
    reason: {
      type: String,
      default: null,
    },
    expires_at: {
      type: Date,
      default: null,
      index: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Created by admin ID is required'],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
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

// Compound index for fast lookups
UserEntitlementOverrideSchema.index({ user_id: 1, entitlement_key: 1 });
// Note: expires_at index already defined inline

// Virtual to get the entitlement definition
UserEntitlementOverrideSchema.virtual('definition', {
  ref: 'EntitlementDefinition',
  localField: 'entitlement_key',
  foreignField: 'key',
  justOne: true,
});

// Virtual to get the admin who created this
UserEntitlementOverrideSchema.virtual('admin', {
  ref: 'Admin',
  localField: 'created_by',
  foreignField: '_id',
  justOne: true,
});

const UserEntitlementOverride: Model<IUserEntitlementOverride> = 
  mongoose.model<IUserEntitlementOverride>('UserEntitlementOverride', UserEntitlementOverrideSchema);

export default UserEntitlementOverride;
