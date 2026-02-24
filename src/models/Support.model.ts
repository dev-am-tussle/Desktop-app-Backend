import mongoose, { Schema, Document } from 'mongoose';

export interface ISupport extends Document {
  user_id?: mongoose.Types.ObjectId;
  name: string;
  user_email: string;
  subject?: string;
  message: string;
  consentChecked: boolean;
  metadata?: {
    deviceId?: string;
    platform?: string;
    appVersion?: string;
    timestamp?: string;
  };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupportSchema: Schema<ISupport> = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    user_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: false,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    consentChecked: {
      type: Boolean,
      default: false,
    },
    metadata: {
      deviceId: String,
      platform: String,
      appVersion: String,
      timestamp: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for Cosmos DB sorting and filtering
SupportSchema.index({ createdAt: -1 });
SupportSchema.index({ isRead: 1 });
SupportSchema.index({ user_id: 1 });

export default mongoose.model<ISupport>('Support', SupportSchema);
