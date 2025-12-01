import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'one-time';
  seats: number;
  features: string[];
  maxModels?: number;
  offlineModelSizeLimit?: number;
  status: 'active' | 'archived';
  // Stripe Integration Fields
  stripeProductId?: string;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema: Schema<ISubscriptionPlan> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      uppercase: true,
      match: [/^[A-Z]{3}$/, 'Currency must be a valid ISO 4217 code (e.g., USD)'],
      default: 'USD',
    },
    billingPeriod: {
      type: String,
      enum: ['monthly', 'yearly', 'one-time'],
      required: [true, 'Billing period is required'],
    },
    seats: {
      type: Number,
      required: [true, 'Seats are required'],
      min: [1, 'Seats must be at least 1'],
      max: [1000, 'Seats cannot exceed 1000'],
    },
    features: {
      type: [String],
      default: [],
    },
    maxModels: {
      type: Number,
      default: null,
    },
    offlineModelSizeLimit: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    // Stripe Integration Fields
    stripeProductId: {
      type: String,
      default: null,
      index: true,
    },
    stripePriceId: {
      type: String,
      default: null,
      index: true,
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

// Virtual for activeSubscribers count
SubscriptionPlanSchema.virtual('activeSubscribers', {
  ref: 'Subscription',
  localField: '_id',
  foreignField: 'planId',
  count: true,
  match: { status: 'active' },
});

const SubscriptionPlan: Model<ISubscriptionPlan> = mongoose.model<ISubscriptionPlan>(
  'SubscriptionPlan',
  SubscriptionPlanSchema
);

export default SubscriptionPlan;
