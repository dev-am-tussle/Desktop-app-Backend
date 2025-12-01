import mongoose, { Schema, Document, Model as MongooseModel } from 'mongoose';

export interface IModelVersion {
  version: string;
  releaseDate: Date;
  size: number;
  changelog?: string;
  downloadUrl: string;
  installed: boolean;
}

export interface IModel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  versions: IModelVersion[];
  size: number;
  installed: boolean;
  hybridCapable: boolean;
  offlineSupported: boolean;
  status: 'up-to-date' | 'update-available' | 'deprecated';
  lastUsedAt?: Date;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const ModelVersionSchema: Schema = new Schema(
  {
    version: {
      type: String,
      required: true,
      match: [/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'],
    },
    releaseDate: {
      type: Date,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: [0, 'Size cannot be negative'],
    },
    changelog: {
      type: String,
      default: null,
    },
    downloadUrl: {
      type: String,
      required: true,
    },
    installed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ModelSchema: Schema<IModel> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Model name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    versions: {
      type: [ModelVersionSchema],
      default: [],
    },
    size: {
      type: Number,
      required: [true, 'Size is required'],
      min: [0, 'Size cannot be negative'],
    },
    installed: {
      type: Boolean,
      default: false,
    },
    hybridCapable: {
      type: Boolean,
      default: false,
    },
    offlineSupported: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['up-to-date', 'update-available', 'deprecated'],
      default: 'up-to-date',
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
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

// Indexes
ModelSchema.index({ category: 1, status: 1 });
ModelSchema.index({ installed: 1 });

const Model: MongooseModel<IModel> = mongoose.model<IModel>('Model', ModelSchema);

export default Model;
