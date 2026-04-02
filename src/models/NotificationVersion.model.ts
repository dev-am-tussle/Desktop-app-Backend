import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationVersion extends Document {
  currentVersion: number;
  lastIncrementedAt: Date;
}

const NotificationVersionSchema: Schema<INotificationVersion> = new Schema(
  {
    currentVersion: {
      type: Number,
      default: 0,
      required: true
    },
    lastIncrementedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model<INotificationVersion>('NotificationVersion', NotificationVersionSchema);
