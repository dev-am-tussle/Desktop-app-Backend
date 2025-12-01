import mongoose, { Schema, Document, Model } from 'mongoose';
import CryptoJS from 'crypto-js';

export interface IApiKey extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  key: string;
  maskedKey: string;
  createdAt: Date;
  lastUsed?: Date;
  encryptKey(): void;
  decryptKey(): string;
}

const ApiKeySchema: Schema<IApiKey> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
    },
    key: {
      type: String,
      required: [true, 'API key is required'],
      select: false, // Don't include in queries by default
    },
    maskedKey: {
      type: String,
      required: true,
    },
    lastUsed: {
      type: Date,
      default: null,
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
        delete ret.key;
        return ret;
      },
    },
  }
);

// Indexes
ApiKeySchema.index({ userId: 1, createdAt: -1 });

// Encrypt API key before saving
ApiKeySchema.pre('save', function (next) {
  if (this.isModified('key')) {
    this.encryptKey();
    this.maskedKey = maskApiKey(this.key);
  }
  next();
});

// Method to encrypt API key
ApiKeySchema.methods.encryptKey = function (): void {
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  this.key = CryptoJS.AES.encrypt(this.key, encryptionKey).toString();
};

// Method to decrypt API key
ApiKeySchema.methods.decryptKey = function (): string {
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const bytes = CryptoJS.AES.decrypt(this.key, encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Helper function to mask API key
function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.substring(0, 4)}...${key.slice(-4)}`;
}

const ApiKey: Model<IApiKey> = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

export default ApiKey;
