import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'promotion' | 'update';
  category: 'system' | 'marketing' | 'security' | 'feature';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetType: 'all' | 'segment' | 'specific';
  targetFilters?: {
    plan?: 'free' | 'pro' | 'enterprise';
    platform?: 'windows' | 'mac' | 'linux';
    appVersion?: string;
    region?: string;
  };
  targetUserIds?: mongoose.Types.ObjectId[]; // Only for 'specific' target
  action?: {
    type: 'link' | 'deeplink' | 'download' | 'none';
    url?: string;
    label?: string;
  };
  createdBy: mongoose.Types.ObjectId; // Admin ID
  expiresAt?: Date;
  status: 'draft' | 'active' | 'scheduled' | 'expired';
  scheduledAt?: Date;
  publishedAt?: Date;
  isDismissible: boolean;
  version: number;
  isDeleted: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema<INotification> = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'promotion', 'update'],
      default: 'info',
    },
    category: {
      type: String,
      enum: ['system', 'marketing', 'security', 'feature'],
      default: 'system',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'low',
    },
    targetType: {
      type: String,
      enum: ['all', 'segment', 'specific'],
      default: 'all',
    },
    targetFilters: {
      plan: { type: String },
      platform: { type: String },
      appVersion: { type: String },
      region: { type: String },
    },
    targetUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    action: {
      type: {
        type: String,
        enum: ['link', 'deeplink', 'download', 'none'],
        default: 'none',
      },
      url: { type: String },
      label: { type: String },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    expiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'scheduled', 'expired'],
      default: 'draft',
    },
    scheduledAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
    },
    isDismissible: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Better indexes for production
NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ targetType: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ isDeleted: 1 });
NotificationSchema.index({ version: 1 }); // For delta sync sorting

export default mongoose.model<INotification>('Notification', NotificationSchema);
