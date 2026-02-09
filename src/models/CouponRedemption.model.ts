import mongoose, { Schema, Document } from 'mongoose';

export interface ICouponRedemption extends Document {
  coupon_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  device_id?: string;
  redeemed_at: Date;
  plan_id?: mongoose.Types.ObjectId; // Denormalized for easy reporting
  expires_at: Date; // Calculated based on coupon validity_days
}

const CouponRedemptionSchema: Schema<ICouponRedemption> = new Schema(
  {
    coupon_id: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    device_id: {
      type: String,
      trim: true,
    },
    redeemed_at: {
      type: Date,
      default: Date.now,
    },
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: false,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance and Cosmos DB sorting requirements
CouponRedemptionSchema.index({ coupon_id: 1, user_id: 1 });
CouponRedemptionSchema.index({ redeemed_at: -1 });
CouponRedemptionSchema.index({ coupon_id: 1, redeemed_at: -1 });

export const CouponRedemption = mongoose.model<ICouponRedemption>('CouponRedemption', CouponRedemptionSchema);
