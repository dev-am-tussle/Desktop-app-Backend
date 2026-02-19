import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SubscriptionPlan Model (RESTRUCTURED)
 * Now contains ONLY commercial info (pricing, billing)
 * Features/entitlements moved to PlanEntitlement model
 */

export interface IPriceData {
  amount: number;              // Amount in cents (1999 = $19.99)
  stripe_price_id: string;     // Stripe price object ID
  source: 'base' | 'manual' | 'auto_converted'; // How price was set
}

export interface IPricingMetadata {
  base_currency: string;       // "AUD" - always base currency
  base_amount_monthly: number; // Monthly price in cents
  base_amount_yearly?: number; // Yearly price in cents (optional)
  supported_currencies: string[]; // List of supported currencies
  conversion_applied_on: Date; // When conversion was last applied
  conversion_source: string;   // "stripe_rates", "manual_input", etc.
}

export interface ISubscriptionPlan extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;                      // "free", "pro", "business", "enterprise"
  display_name: string;              // "Pro Plan"
  slug: string;                      // URL-friendly identifier
  description?: string;
  features: string[];                // Marketing features list
  category: 'personal' | 'business' | 'enterprise'; // Plan category for filtering
  
  // Multi-Currency Pricing (REQUIRED)
  prices: {
    monthly: Record<string, IPriceData>;  // { AUD: {...}, USD: {...}, INR: {...} }
    yearly?: Record<string, IPriceData>;  // Same structure for yearly
  };
  
  // Pricing Metadata (REQUIRED)
  pricing_metadata: IPricingMetadata;
  
  is_contact_sales: boolean;         // For Enterprise plan
  stripe_product_id: string;         // Stripe product ID
  
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
    features: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr: string[]) {
          return arr.length <= 10; // Max 10 feature items
        },
        message: 'Features array cannot have more than 10 items'
      }
    },
    category: {
      type: String,
      enum: ['personal', 'business', 'enterprise'],
      required: [true, 'Plan category is required'],
      default: 'personal',
      index: true,
    },
    // Multi-Currency Pricing Structure (REQUIRED)
    prices: {
      type: Schema.Types.Mixed,
      required: [true, 'Prices object is required'],
      validate: {
        validator: function(prices: any) {
          if (!prices || !prices.monthly || typeof prices.monthly !== 'object') return false;
          for (const [_currency, priceData] of Object.entries(prices.monthly)) {
            const p = priceData as any;
            if (!p || typeof p !== 'object') return false;
            if (typeof p.amount !== 'number' || p.amount < 0) return false;
            if (typeof p.stripe_price_id !== 'string') return false;
            if (!['base', 'manual', 'auto_converted'].includes(p.source)) return false;
          }
          return true;
        },
        message: 'Prices must have valid structure with amount, stripe_price_id, and source'
      }
    },
    // Pricing Metadata (REQUIRED - tracks pricing source and conversion details)
    pricing_metadata: {
      type: Schema.Types.Mixed,
      required: [true, 'Pricing metadata is required'],
      validate: {
        validator: function(metadata: any) {
          if (!metadata || typeof metadata !== 'object') return false;
          if (metadata.base_currency !== 'AUD') return false;
          if (typeof metadata.base_amount_monthly !== 'number') return false;
          if (!Array.isArray(metadata.supported_currencies)) return false;
          return true;
        },
        message: 'Pricing metadata must be valid'
      }
    },
    is_contact_sales: {
      type: Boolean,
      default: false,
    },
    // Stripe Integration
    stripe_product_id: {
      type: String,
      required: [true, 'Stripe product ID is required for paid plans'],
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
