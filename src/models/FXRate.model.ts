import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * FXRate Model - Simple & Fast
 * Stores exchange rates managed by admin
 */

export interface IFXRate extends Document {
  from_currency: string;
  to_currency: string;
  rate: number;
  is_active: boolean;
  effective_from: Date;
  effective_to?: Date;
  updated_by: string;
  source: 'admin_manual' | 'stripe_api';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FXRateSchema: Schema<IFXRate> = new Schema(
  {
    from_currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    to_currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0.001,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    effective_from: {
      type: Date,
      default: () => new Date(),
    },
    effective_to: {
      type: Date,
      default: null,
    },
    updated_by: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      enum: ['admin_manual', 'stripe_api'],
      default: 'admin_manual',
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const FXRate: Model<IFXRate> = mongoose.model<IFXRate>('FXRate', FXRateSchema);

export default FXRate;
