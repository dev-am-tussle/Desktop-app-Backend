import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * EntitlementDefinition Model
 * Master list of all possible entitlements in the system
 * Single source of truth for what entitlements exist
 */

export interface IEntitlementDefinition extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;                        // "file.upload.max_size_mb"
  type: 'boolean' | 'number' | 'string' | 'array' | 'unlimited';
  category: 'capabilities' | 'limits' | 'resources' | 'deployment' | 'support';
  description: string;
  default_value: any;
  validation_rules?: {
    min?: number;
    max?: number;
    enum?: string[];
  };
  created_at: Date;
  updated_at: Date;
}

const EntitlementDefinitionSchema: Schema<IEntitlementDefinition> = new Schema(
  {
    key: {
      type: String,
      required: [true, 'Entitlement key is required'],
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      // Example: "compare.enabled", "file.upload.max_size_mb"
    },
    type: {
      type: String,
      enum: ['boolean', 'number', 'string', 'array', 'unlimited'],
      required: [true, 'Type is required'],
    },
    category: {
      type: String,
      enum: ['capabilities', 'limits', 'resources', 'deployment', 'support'],
      required: [true, 'Category is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    default_value: {
      type: Schema.Types.Mixed,
      required: [true, 'Default value is required'],
    },
    validation_rules: {
      type: {
        min: { type: Number },
        max: { type: Number },
        enum: { type: [String] },
      },
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
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

// Indexes for performance
EntitlementDefinitionSchema.index({ category: 1, key: 1 });

const EntitlementDefinition: Model<IEntitlementDefinition> = 
  mongoose.model<IEntitlementDefinition>('EntitlementDefinition', EntitlementDefinitionSchema);

export default EntitlementDefinition;
