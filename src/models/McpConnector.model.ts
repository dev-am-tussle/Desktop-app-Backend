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
  auth?: {
    category:
      | 'oauth2_authorization_code'
      | 'oauth2_client_credentials'
      | 'api_key'
      | 'personal_access_token'
      | 'basic_auth'
      | 'none';
    execution?: 'redirect' | 'form' | 'none' | 'device_code';
    sessionRequired?: boolean;
    oauth?: {
      provider?: string;
      flow?: 'authorization_code' | 'pkce' | 'device_code';
      authorizationUrl?: string;
      tokenUrl?: string;
      scopes?: string[];
      pkceRequired?: boolean;
      clientIdEnvKey?: string;
      clientSecretEnvKey?: string;
      redirectUriEnvKey?: string;
    };
    tokenPlacement?: {
      type: 'header' | 'query' | 'body';
      key: string;
      format?: string;
    };
    ui?: {
      type: 'redirect' | 'form' | 'none' | 'device_code';
      instructions?: string;
    };
    tokenLifecycle?: {
      autoRefresh?: boolean;
      expiryBufferSeconds?: number;
    };
  };
  capabilities?: {
    requiresAuth: boolean;
    supportsBackgroundSync?: boolean;
    supportsRealtime?: boolean;
    authUsage?: {
      type?: 'per-request' | 'session-based';
      injection?: 'header' | 'query' | 'body';
    };
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
    auth: {
      category: {
        type: String,
        enum: ['oauth2_authorization_code', 'oauth2_client_credentials', 'api_key', 'personal_access_token', 'basic_auth', 'none'],
        default: null,
      },
      execution: {
        type: String,
        enum: ['redirect', 'form', 'none', 'device_code'],
        default: null,
      },
      sessionRequired: {
        type: Boolean,
        default: null,
      },
      oauth: {
        provider: { type: String, default: null },
        flow: {
          type: String,
          enum: ['authorization_code', 'pkce', 'device_code'],
          default: null,
        },
        authorizationUrl: { type: String, default: null },
        tokenUrl: { type: String, default: null },
        scopes: { type: [String], default: [] },
        pkceRequired: { type: Boolean, default: null },
        clientIdEnvKey: { type: String, default: null },
        clientSecretEnvKey: { type: String, default: null },
        redirectUriEnvKey: { type: String, default: null },
      },
      tokenPlacement: {
        type: {
          type: String,
          enum: ['header', 'query', 'body'],
          default: null,
        },
        key: { type: String, default: null },
        format: { type: String, default: null },
      },
      ui: {
        type: {
          type: String,
          enum: ['redirect', 'form', 'none', 'device_code'],
          default: null,
        },
        instructions: { type: String, default: null },
      },
      tokenLifecycle: {
        autoRefresh: { type: Boolean, default: null },
        expiryBufferSeconds: { type: Number, default: null },
      },
    },
    capabilities: {
      requiresAuth: { type: Boolean, default: true },
      supportsBackgroundSync: { type: Boolean, default: false },
      supportsRealtime: { type: Boolean, default: false },
      authUsage: {
        type: {
          type: String,
          enum: ['per-request', 'session-based'],
          default: null,
        },
        injection: {
          type: String,
          enum: ['header', 'query', 'body'],
          default: null,
        },
      },
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
