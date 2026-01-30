import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SubscriptionPlan Model (RESTRUCTURED)
 * Now contains ONLY commercial info (pricing, billing)
 * Features/entitlements moved to PlanEntitlement model
 */

export interface ISubscriptionPlan extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;                      // "free", "pro", "business", "enterprise"
  display_name: string;              // "Pro Plan"
  slug: string;                      // URL-friendly identifier
  description?: string;
  
  // Pricing
  price_monthly: number;             // Monthly price (0 for free)
  price_yearly?: number;             // Annual price (optional)
  currency: string;                  // "AUD"
  is_contact_sales: boolean;         // For Enterprise plan
  
  // Stripe Integration
  stripe_product_id?: string;
  stripe_price_monthly_id?: string;
  stripe_price_yearly_id?: string;
  
  // Meta
  status: 'active' | 'archived';
  sort_order: number;                // Display order (1, 2, 3, 4)
  
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema: Schema<ISubscriptionPlan> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    display_name: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
    // Pricing
    price_monthly: {
      type: Number,
      required: [true, 'Monthly price is required'],
      min: [0, 'Price cannot be negative'],
    },
    price_yearly: {
      type: Number,
      default: null,
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      uppercase: true,
      match: [/^[A-Z]{3}$/, 'Currency must be a valid ISO 4217 code (e.g., AUD)'],
      default: 'AUD',
    },
    is_contact_sales: {
      type: Boolean,
      default: false,
    },
    // Stripe Integration
    stripe_product_id: {
      type: String,
      default: null,
      index: true,
    },
    stripe_price_monthly_id: {
      type: String,
      default: null,
      index: true,
    },
    stripe_price_yearly_id: {
      type: String,
      default: null,
      index: true,
    },
    // Meta
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    sort_order: {
      type: Number,
      required: [true, 'Sort order is required'],
      min: [1, 'Sort order must be at least 1'],
      default: 1,
    },
  },
  {
    timestamps: true,
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

// Virtual for active users count
SubscriptionPlanSchema.virtual('activeUsers', {
  ref: 'User',
  localField: '_id',
  foreignField: 'plan_id',
  count: true,
  match: { subscription_status: 'active' },
});

// Virtual for plan entitlements
SubscriptionPlanSchema.virtual('entitlements', {
  ref: 'PlanEntitlement',
  localField: '_id',
  foreignField: 'plan_id',
});

const SubscriptionPlan: Model<ISubscriptionPlan> = mongoose.model<ISubscriptionPlan>(
  'SubscriptionPlan',
  SubscriptionPlanSchema
);

export default SubscriptionPlan;
