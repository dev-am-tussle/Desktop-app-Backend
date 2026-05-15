import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailVerification extends Document {
    email: string;
    name: string;
    code: string;
    attempts: number;
    blockedUntil?: Date;
    verifiedAt?: Date;
    isVerified: boolean;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const EmailVerificationSchema = new Schema<IEmailVerification>(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        code: {
            type: String,
            required: true,
        },
        attempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        blockedUntil: {
            type: Date,
            default: null,
        },
        verifiedAt: {
            type: Date,
            default: null,
        },
        isVerified: {
            type: Boolean,
            default: false,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expireAfterSeconds: 0 }, // ✅ TTL index: auto-delete when expiresAt is reached
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for faster lookups
EmailVerificationSchema.index({ email: 1, isVerified: 1 });

const EmailVerification = mongoose.model<IEmailVerification>(
    'EmailVerification',
    EmailVerificationSchema
);

export default EmailVerification;
