import mongoose, { Schema, Document } from 'mongoose';

export interface IConnectorAuthSession extends Document {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  connectorId: mongoose.Types.ObjectId;
  connectorName: string;
  connectorTitle: string;
  authMethod?: 'oauth2' | 'manual';
  provider?: string;
  status: 'created' | 'pending' | 'authenticated' | 'failed' | 'expired';
  state: string;
  nonce: string;
  codeVerifier?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
  authUrl: string;
  portalOrigin: string;
  redirectUri: string;
  deviceId?: string;
  platform?: string;
  expiresAt: Date;
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  idToken?: string;
  tokenType?: string;
  scope?: string;
  providerAccountId?: string;
  tokenExpiresAt?: Date;
  lastError?: {
    code?: string;
    message?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConnectorAuthSessionSchema: Schema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    connectorId: {
      type: Schema.Types.ObjectId,
      ref: 'McpConnector',
      required: true,
      index: true,
    },
    connectorName: {
      type: String,
      required: true,
      trim: true,
    },
    connectorTitle: {
      type: String,
      required: true,
      trim: true,
    },
    authMethod: {
      type: String,
      enum: ['oauth2', 'manual'],
      default: 'oauth2',
    },
    provider: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['created', 'pending', 'authenticated', 'failed', 'expired'],
      default: 'created',
      index: true,
    },
    state: {
      type: String,
      required: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    codeVerifier: {
      type: String,
      default: null,
      select: false,
    },
    codeChallenge: {
      type: String,
      default: null,
      select: false,
    },
    codeChallengeMethod: {
      type: String,
      enum: ['S256'],
      default: null,
      select: false,
    },
    authUrl: {
      type: String,
      required: true,
    },
    portalOrigin: {
      type: String,
      required: true,
    },
    redirectUri: {
      type: String,
      required: true,
    },
    deviceId: {
      type: String,
      default: null,
      index: true,
    },
    platform: {
      type: String,
      default: null,
      index: true,
    },
    encryptedAccessToken: {
      type: String,
      default: null,
      select: false,
    },
    encryptedRefreshToken: {
      type: String,
      default: null,
      select: false,
    },
    idToken: {
      type: String,
      default: null,
      select: false,
    },
    tokenType: {
      type: String,
      default: null,
      select: false,
    },
    scope: {
      type: String,
      default: null,
      select: false,
    },
    providerAccountId: {
      type: String,
      default: null,
      index: true,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastError: {
      code: {
        type: String,
        default: null,
      },
      message: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

ConnectorAuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ConnectorAuthSessionSchema.index({ userId: 1, connectorId: 1, createdAt: -1 });

export default mongoose.model<IConnectorAuthSession>('ConnectorAuthSession', ConnectorAuthSessionSchema);
