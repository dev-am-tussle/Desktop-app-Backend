import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPaymentSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  stripeSessionId: string;
  stripeCustomerId?: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSessionSchema: Schema<IPaymentSession> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: [true, 'Plan ID is required'],
      index: true,
    },
    stripeSessionId: {
      type: String,
      required: [true, 'Stripe session ID is required'],
      unique: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'expired'],
      default: 'pending',
      index: true,
    },
    amount: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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

// Indexes for performance
PaymentSessionSchema.index({ userId: 1, status: 1 });
PaymentSessionSchema.index({ createdAt: -1 });

const PaymentSession: Model<IPaymentSession> = mongoose.model<IPaymentSession>(
  'PaymentSession',
  PaymentSessionSchema
);

export default PaymentSession;
