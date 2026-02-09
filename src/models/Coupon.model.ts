import mongoose, { Schema, Document } from 'mongoose';

export interface IEntitlementItem {
  entitlement_key: string;
  value: any;
}

export interface ICouponEntitlements {
  capabilities?: IEntitlementItem[];
  deployment?: IEntitlementItem[];
  limits?: IEntitlementItem[];
  resources?: IEntitlementItem[];
  support?: IEntitlementItem[];
}

export interface ICoupon extends Document {
  code: string;
  validity: number;
  max_redemptions: number;
  max_redemptions_per_user: number;
  description: string;
  expires_at: Date;
  type: 'plan' | 'custom';
  plan_id?: mongoose.Types.ObjectId;
  status: 'active' | 'disabled' | 'expired';
  redeemed_count: number;
  entitlements?: ICouponEntitlements;
  metadata: any[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EntitlementItemSchema = new Schema(
  {
    entitlement_key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const CouponSchema: Schema<ICoupon> = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    validity: {
      type: Number,
      required: true,
      min: 0,
    },
    max_redemptions: {
      type: Number,
      required: true,
      default: 1,
    },
    max_redemptions_per_user: {
      type: Number,
      required: true,
      default: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ['plan', 'custom'],
      required: true,
      default: 'plan',
    },
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: function(this: ICoupon) {
        return this.type === 'plan';
      },
    },
    status: {
      type: String,
      enum: ['active', 'disabled', 'expired'],
      default: 'active',
    },
    redeemed_count: {
      type: Number,
      default: 0,
    },
    entitlements: {
      type: {
        capabilities: [EntitlementItemSchema],
        deployment: [EntitlementItemSchema],
        limits: [EntitlementItemSchema],
        resources: [EntitlementItemSchema],
        support: [EntitlementItemSchema],
      },
      required: function(this: ICoupon) {
        return this.type === 'custom';
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for Cosmos DB / MongoDB sorting
CouponSchema.index({ createdAt: -1 });

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);
