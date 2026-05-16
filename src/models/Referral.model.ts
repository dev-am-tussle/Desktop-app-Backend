import mongoose, { Document, Schema } from "mongoose";

// ─── Sub-document types ───────────────────────────────────────────────────────

export interface IInvitee {
    user_id: mongoose.Types.ObjectId;
    name: string; // snapshot at join time
    status: "invited" | "joined" | "rewarded";
    joined_at: Date;
    rewarded_at?: Date;
    metadata: {
        device_id?: string;
        platform?: string;
        app_version?: string;
    };
}

export interface IReward {
    type: string; // e.g. "pro_1_month"
    triggered_by: mongoose.Types.ObjectId; // referee user_id
    granted_at: Date;
    pro_extended_until: Date;
    status: "pending" | "applied" | "failed";
    value_days: number; // 30 for now, variable in future
}

export interface IMetadata {
    device_id?: string;
    platform?: string;
    app_version?: string;
    created_at: Date;
}

// ─── Main document type ───────────────────────────────────────────────────────

export interface IReferral extends Document {
    user_id: mongoose.Types.ObjectId;
    code: string;
    invitees: IInvitee[];
    rewards: IReward[];
    metadata: IMetadata;
    is_active: boolean;
    total_rewards_earned: number; // denormalized — for fast stats
    createdAt: Date;
    updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const InviteeSchema = new Schema<IInvitee>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true },
        status: {
            type: String,
            enum: ["invited", "joined", "rewarded"],
            default: "joined",
        },
        joined_at: { type: Date, default: Date.now },
        rewarded_at: { type: Date },
        metadata: {
            device_id: { type: String },
            platform: { type: String },
            app_version: { type: String },
        },
    },
    { _id: false }
);

const RewardSchema = new Schema<IReward>(
    {
        type: { type: String, required: true, default: "pro_1_month" },
        triggered_by: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        granted_at: { type: Date, default: Date.now },
        pro_extended_until: { type: Date, required: true },
        status: {
            type: String,
            enum: ["pending", "applied", "failed"],
            default: "applied",
        },
        value_days: { type: Number, default: 30 },
    },
    { _id: false }
);

const ReferralSchema = new Schema<IReferral>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        invitees: { type: [InviteeSchema], default: [] },
        rewards: { type: [RewardSchema], default: [] },
        metadata: {
            device_id: { type: String },
            platform: { type: String },
            app_version: { type: String },
            created_at: { type: Date, default: Date.now },
        },
        is_active: { type: Boolean, default: true },
        total_rewards_earned: { type: Number, default: 0 },
    },
    {
        timestamps: true, // adds createdAt, updatedAt
    }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

ReferralSchema.index({ code: 1 }, { unique: true });
ReferralSchema.index({ user_id: 1 }, { unique: true });
ReferralSchema.index({ "invitees.user_id": 1 }); // for duplicate check on activate

// ─── Export ───────────────────────────────────────────────────────────────────

const Referral = mongoose.model<IReferral>("Referral", ReferralSchema);
export default Referral;