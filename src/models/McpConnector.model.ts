import mongoose, { Schema, Document } from 'mongoose';

export interface IMcpConnector extends Document {
  name: string;
  title: string;
  description: string;
  descriptionFormat: 'text' | 'markdown';
  detailedDescription?: string;
  detailedDescriptionFormat?: 'text' | 'markdown';
  iconUrl: string;
  category: string;
  status: 'verified' | 'unverified' | 'deprecated';
  version: string;
  changelogUrl?: string;
  tags: {
    label: string; // 'New', 'Early Launch', 'Warning'
    type: 'info' | 'success' | 'warning' | 'error';
  }[];
  isPopular: boolean;
  developer: {
    name: string;
    url?: string;
  };
  tools: {
    name: string;
    description?: string;
  }[];
  moreInfo: {
    label: string;
    url: string;
  }[];
  privacy: {
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
  };
  connectorUrl?: string; // The primary URL for the connector
  runtime: {
    engine: 'npx' | 'node' | 'python' | 'docker' | 'exe';
    package?: string; // For npx/npm packages
    command?: string; // For node/exe paths
    args: string[];
    envVarsMetadata: {
      key: string;
      label: string;
      placeholder?: string;
      description?: string;
      required?: boolean;
    }[];
  };
  permissions: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const McpConnectorSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    descriptionFormat: {
      type: String,
      enum: ['text', 'markdown'],
      default: 'text'
    },
    detailedDescription: {
      type: String,
      default: null
    },
    detailedDescriptionFormat: {
      type: String,
      enum: ['text', 'markdown'],
      default: 'text'
    },
    iconUrl: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['verified', 'unverified', 'deprecated'],
      default: 'unverified'
    },
    version: {
      type: String,
      required: true,
      default: '1.0.0'
    },
    changelogUrl: {
      type: String,
      default: null
    },
    tags: [
      {
        label: { type: String, required: true },
        type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' }
      }
    ],
    isPopular: {
      type: Boolean,
      default: false
    },
    developer: {
      name: { type: String, required: true },
      url: { type: String, default: null }
    },
    tools: [
      {
        name: { type: String, required: true },
        description: { type: String, default: null }
      }
    ],
    moreInfo: [
      {
        label: { type: String, required: true },
        url: { type: String, required: true }
      }
    ],
    privacy: {
      privacyPolicyUrl: { type: String, default: null },
      termsOfServiceUrl: { type: String, default: null }
    },
    connectorUrl: {
      type: String,
      default: null
    },
    runtime: {
      engine: {
        type: String,
        enum: ['npx', 'node', 'python', 'docker', 'exe'],
        required: true
      },
      package: {
        type: String,
        default: null
      },
      command: {
        type: String,
        default: null
      },
      args: {
        type: [String],
        default: []
      },
      envVarsMetadata: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          placeholder: { type: String, default: null },
          description: { type: String, default: null },
          required: { type: Boolean, default: true }
        }
      ]
    },
    permissions: {
      type: [String],
      default: []
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Add index for marketplace queries
McpConnectorSchema.index({ isArchived: 1, category: 1 });
McpConnectorSchema.index({ isPopular: -1, name: 1 });
McpConnectorSchema.index({ isArchived: 1, isPopular: -1, name: 1 });

export default mongoose.model<IMcpConnector>('McpConnector', McpConnectorSchema);
