import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserTelemetry extends Document {
  user_id: mongoose.Types.ObjectId;
  global_ts: number;
  payload: any;
  createdAt: Date;
  updatedAt: Date;
}

const UserTelemetrySchema: Schema<IUserTelemetry> = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    global_ts: {
      type: Number,
      required: true,
      index: true, // Used for smart sync checks
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find the latest telemetry for a user
UserTelemetrySchema.index({ user_id: 1, global_ts: -1 });

const UserTelemetry: Model<IUserTelemetry> = mongoose.model<IUserTelemetry>('UserTelemetry', UserTelemetrySchema);

export default UserTelemetry;
