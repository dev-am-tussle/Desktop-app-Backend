import mongoose, { Schema, Document } from 'mongoose';

export interface IRecommendedModel extends Document {
  name: string;
  ollamaName: string;
  description?: string;
  size?: string;
  ram?: string;
  tag?: string;
  category: 'text' | 'vision' | 'code' | 'other';
  provider: 'ollama' | 'gguf';
  downloadUrl?: string;
  isPopular: boolean;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendedModelSchema: Schema<IRecommendedModel> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ollamaName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      trim: true,
    },
    ram: {
      type: String,
      trim: true,
    },
    tag: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['text', 'vision', 'code', 'other'],
      default: 'text',
    },
    provider: {
      type: String,
      enum: ['ollama', 'gguf'],
      default: 'ollama',
      required: true,
    },
    downloadUrl: {
      type: String,
      trim: true,
      default: null,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for sorting/filtering
RecommendedModelSchema.index({ order: 1 });
RecommendedModelSchema.index({ isActive: 1 });

export default mongoose.model<IRecommendedModel>('RecommendedModel', RecommendedModelSchema);
