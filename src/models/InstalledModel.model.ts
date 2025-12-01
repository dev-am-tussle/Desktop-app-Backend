import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInstalledModel extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  modelId: mongoose.Types.ObjectId;
  modelName: string;
  version: string;
  installedAt: Date;
  size: number;
  createdAt: Date;
}

const InstalledModelSchema: Schema<IInstalledModel> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    modelId: {
      type: Schema.Types.ObjectId,
      ref: 'Model',
      required: [true, 'Model ID is required'],
    },
    modelName: {
      type: String,
      required: [true, 'Model name is required'],
    },
    version: {
      type: String,
      required: [true, 'Version is required'],
      match: [/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning'],
    },
    installedAt: {
      type: Date,
      default: Date.now,
    },
    size: {
      type: Number,
      required: [true, 'Size is required'],
      min: [0, 'Size cannot be negative'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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
InstalledModelSchema.index({ userId: 1, modelId: 1 });
InstalledModelSchema.index({ installedAt: -1 });

const InstalledModel: Model<IInstalledModel> = mongoose.model<IInstalledModel>(
  'InstalledModel',
  InstalledModelSchema
);

export default InstalledModel;
