import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface ILicense extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  userId?: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: 'active' | 'expired' | 'revoked';
  issuedAt: Date;
  expiresAt?: Date;
  allowedModels?: string[];
  seats: number;
  activations: number;
  lastActivationIp?: string;
  lastActivationAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LicenseSchema: Schema<ILicense> = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: [true, 'Plan ID is required'],
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    allowedModels: {
      type: [String],
      default: null,
    },
    seats: {
      type: Number,
      required: [true, 'Seats are required'],
      min: [1, 'Seats must be at least 1'],
      max: [1000, 'Seats cannot exceed 1000'],
      default: 1,
    },
    activations: {
      type: Number,
      default: 0,
      min: [0, 'Activations cannot be negative'],
    },
    lastActivationIp: {
      type: String,
      default: null,
    },
    lastActivationAt: {
      type: Date,
      default: null,
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

// Indexes
LicenseSchema.index({ userId: 1, status: 1 });
LicenseSchema.index({ planId: 1 });

// Generate license key before saving
LicenseSchema.pre('save', function (next) {
  if (!this.key) {
    this.key = generateLicenseKey();
  }
  next();
});

// Helper function to generate license key
function generateLicenseKey(): string {
  const segments = 4;
  const segmentLength = 4;
  const key: string[] = [];

  for (let i = 0; i < segments; i++) {
    const segment = crypto
      .randomBytes(segmentLength)
      .toString('hex')
      .toUpperCase()
      .substring(0, segmentLength);
    key.push(segment);
  }

  return key.join('-');
}

const License: Model<ILicense> = mongoose.model<ILicense>('License', LicenseSchema);

export default License;
