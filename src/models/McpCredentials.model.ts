import mongoose, { Schema, Document } from 'mongoose';

export interface IMcpCredentials extends Document {
  userId?: mongoose.Types.ObjectId; // ✅ Made optional for global credentials
  connectorName: string;
  connectorId?: mongoose.Types.ObjectId;
  encryptedCredentials: string;
  accessToken: string;
  tokenExpiresAt: Date;
  status: 'active' | 'revoked' | 'expired';
  revokedAt?: Date;
  credentialMetadata?: {
    lastVerifiedAt?: Date;
    scope?: string[];
    provider?: string;
    accountInfo?: string;
    isGlobal?: boolean; // ✅ Add this flag
  };
  createdAt: Date;
  updatedAt: Date;
}

const McpCredentialsSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // ✅ Changed to false for global credentials
      index: true,
    },
    connectorName: {
      type: String,
      required: true,
      index: true,
    },
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'McpConnector',
      required: false,
    },
    encryptedCredentials: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenExpiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      index: true,
    },
    revokedAt: {
      type: Date,
      required: false,
    },
    credentialMetadata: {
      type: {
        lastVerifiedAt: Date,
        scope: [String],
        provider: String,
        accountInfo: String,
        isGlobal: Boolean, // ✅ Add isGlobal flag
      },
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Updated indexes - userId is now optional
McpCredentialsSchema.index({ connectorName: 1, status: 1 }); // For global lookups
McpCredentialsSchema.index({ userId: 1, connectorName: 1, status: 1 }); // For user-specific (if needed)
McpCredentialsSchema.index({ accessToken: 1, status: 1 });

// TTL index - Auto-delete expired tokens
McpCredentialsSchema.index(
  { tokenExpiresAt: 1 },
  { expireAfterSeconds: 86400 }
);

const McpCredentials = mongoose.model<IMcpCredentials>(
  'McpCredentials',
  McpCredentialsSchema
);

export default McpCredentials;