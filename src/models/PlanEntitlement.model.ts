import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * PlanEntitlement Model
 * Maps subscription plans to their entitlements
 * This is the HEART of the pricing logic - flat key-value store
 */

export interface IPlanEntitlement extends Document {
  _id: mongoose.Types.ObjectId;
  plan_id: mongoose.Types.ObjectId;
  entitlement_key: string;
  value: any;                        // boolean | number | string | array | "unlimited"
  created_at: Date;
  updated_at: Date;
}

const PlanEntitlementSchema: Schema<IPlanEntitlement> = new Schema(
  {
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: [true, 'Plan ID is required'],
      index: true,
    },
    entitlement_key: {
      type: String,
      required: [true, 'Entitlement key is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: [true, 'Value is required'],
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

// Compound unique index - each plan can have each entitlement only once
PlanEntitlementSchema.index({ plan_id: 1, entitlement_key: 1 }, { unique: true });

// Virtual to get the entitlement definition
PlanEntitlementSchema.virtual('definition', {
  ref: 'EntitlementDefinition',
  localField: 'entitlement_key',
  foreignField: 'key',
  justOne: true,
});

const PlanEntitlement: Model<IPlanEntitlement> = 
  mongoose.model<IPlanEntitlement>('PlanEntitlement', PlanEntitlementSchema);

export default PlanEntitlement;
