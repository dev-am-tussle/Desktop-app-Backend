import mongoose, { Schema, Document } from 'mongoose';

export interface IOAuthAccount extends Document {
    userId: mongoose.Types.ObjectId;
    provider: 'google' | 'microsoft';
    providerAccountId: string;
    email: string;
    accessToken: string;
    refreshToken?: string;
    expiry: Date;
    createdAt: Date;
    updatedAt: Date;
}

const OAuthAccountSchema = new Schema<IOAuthAccount>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        provider: {
            type: String,
            enum: ['google', 'microsoft'],
            required: true,
        },
        providerAccountId: {
            type: String,
            required: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
        },
        accessToken: {
            type: String,
            required: true,
        },
        refreshToken: {
            type: String,
        },
        expiry: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for unique provider+accountId
OAuthAccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });
// Index for finding by user and provider
OAuthAccountSchema.index({ userId: 1, provider: 1 });

const OAuthAccount = mongoose.model<IOAuthAccount>('OAuthAccount', OAuthAccountSchema);
export default OAuthAccount;