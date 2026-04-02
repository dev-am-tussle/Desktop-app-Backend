import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationRecipient extends Document {
  notificationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  isRead: boolean;
  readAt?: Date;
  isDismissed: boolean;
  dismissedAt?: Date;
  deliveredAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationRecipientSchema: Schema<INotificationRecipient> = new Schema(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    isDismissed: {
      type: Boolean,
      default: false,
    },
    dismissedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup by user and finding unread notifications
NotificationRecipientSchema.index({ userId: 1, notificationId: 1 }, { unique: true });
NotificationRecipientSchema.index({ userId: 1, isRead: 1 });
NotificationRecipientSchema.index({ userId: 1, isDismissed: 1 });

export default mongoose.model<INotificationRecipient>('NotificationRecipient', NotificationRecipientSchema);
