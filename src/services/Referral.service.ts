import crypto from "crypto";
import mongoose from "mongoose";
import Referral from "../models/Referral.model";
import User from "../models/User.model";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a short unique referral code e.g. "A3F9C2D1"
 * Retries if collision found (extremely rare)
 */
async function generateUniqueCode(): Promise<string> {
    const MAX_ATTEMPTS = 5;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const code = crypto.randomBytes(4).toString("hex").toUpperCase();
        const exists = await Referral.findOne({ code });
        if (!exists) return code;
    }
    throw new Error("Could not generate unique referral code. Try again.");
}

// ─── 1. Create Referral Code ──────────────────────────────────────────────────

export async function createReferralCode(
    user_id: string,
    metadata: { device_id?: string; platform?: string; app_version?: string }
) {
    // If user already has a referral doc, just return existing code
    const existing = await Referral.findOne({
        user_id: new mongoose.Types.ObjectId(user_id),
    });

    if (existing) {
        return {
            code: existing.code,
            is_active: existing.is_active,
            already_existed: true,
        };
    }

    // First time — generate code and create doc
    const code = await generateUniqueCode();

    const referral = await Referral.create({
        user_id: new mongoose.Types.ObjectId(user_id),
        code,
        metadata: {
            ...metadata,
            created_at: new Date(),
        },
    });

    return {
        code: referral.code,
        is_active: referral.is_active,
        already_existed: false,
    };
}

// ─── 2. Activate Referral Code ────────────────────────────────────────────────

export async function activateReferralCode(
    code: string,
    new_user_id: string,
    metadata: { device_id?: string; platform?: string; app_version?: string }
) {
    const newUserObjectId = new mongoose.Types.ObjectId(new_user_id);

    // Check 1 — code exists?
    const referralDoc = await Referral.findOne({ code: code.toUpperCase() });
    if (!referralDoc) {
        return { valid: false, reason: "Invalid referral code" };
    }

    // Check 2 — program active?
    if (!referralDoc.is_active) {
        return { valid: false, reason: "This referral code is no longer active" };
    }

    // Check 3 — self referral?
    if (referralDoc.user_id.toString() === new_user_id) {
        return { valid: false, reason: "You cannot use your own referral code" };
    }

    // Check 4 — new user already used some referral code before?
    const alreadyReferred = await Referral.findOne({
        "invitees.user_id": newUserObjectId,
    });
    if (alreadyReferred) {
        return { valid: false, reason: "You have already used a referral code" };
    }

    // Check 5 — get new user's name for snapshot
    const newUser = await User.findById(newUserObjectId).select("name email");
    if (!newUser) {
        return { valid: false, reason: "User not found" };
    }

    // Check 6 — get referrer's name to return to UI ("Invited by Rahul")
    const referrer = await User.findById(referralDoc.user_id).select(
        "name email"
    );

    // All checks passed — push to invitees array
    await Referral.updateOne(
        { code: code.toUpperCase() },
        {
            $push: {
                invitees: {
                    user_id: newUserObjectId,
                    name: newUser.name || newUser.email || "Unknown",
                    status: "joined",
                    joined_at: new Date(),
                    metadata,
                },
            },
        }
    );

    return {
        valid: true,
        invited_by_name: referrer?.name || referrer?.email || "A friend",
        // rewards_preview: extendable in future — your senior can add here
        rewards_preview: [
            {
                type: "pro_1_month",
                description: "1 month Pro subscription",
                value_days: 30,
            },
        ],
        referrer_id: referralDoc.user_id,
        invitee_id: new_user_id,
    };
}

// ─── 3. Get Stats ─────────────────────────────────────────────────────────────

export async function getReferralStats(user_id: string) {
    const referral = await Referral.findOne({
        user_id: new mongoose.Types.ObjectId(user_id),
    });

    if (!referral) {
        // User has never opened referral screen — no doc yet
        return {
            has_referral: false,
            code: null,
            is_active: false,
            stats: {
                invited: 0,
                joined: 0,
                rewarded: 0,
            },
            invitees: [],
            rewards: [],
            total_rewards_earned: 0,
        };
    }

    const invited = referral.invitees.length;
    const joined = referral.invitees.filter(
        (i) => i.status === "joined" || i.status === "rewarded"
    ).length;
    const rewarded = referral.invitees.filter(
        (i) => i.status === "rewarded"
    ).length;

    return {
        has_referral: true,
        code: referral.code,
        is_active: referral.is_active,
        stats: {
            invited,
            joined,
            rewarded,
        },
        invitees: referral.invitees,
        rewards: referral.rewards,
        total_rewards_earned: referral.total_rewards_earned,
    };
}

// ─── 4. Reward Trigger (internal — called by chat service on first message) ───

export async function triggerRewardOnFirstChat(new_user_id: string) {
    const newUserObjectId = new mongoose.Types.ObjectId(new_user_id);

    // Find whose invitees array contains this user
    const referralDoc = await Referral.findOne({
        "invitees.user_id": newUserObjectId,
        "invitees.status": "joined", // not already rewarded
    });

    if (!referralDoc) {
        // Not a referred user — nothing to do
        return { rewarded: false, reason: "No pending referral found" };
    }

    const REWARD_DAYS = 30;
    const now = new Date();

    // Calculate new pro_until for referrer
    // Get referrer's current pro_until from User model if you add it later
    // For now: extend from today or from existing expiry
    const newProUntil = new Date(now);
    newProUntil.setDate(newProUntil.getDate() + REWARD_DAYS);

    // Update invitee status → rewarded
    // Add reward to rewards array
    // Increment total_rewards_earned
    await Referral.updateOne(
        {
            _id: referralDoc._id,
            "invitees.user_id": newUserObjectId,
        },
        {
            $set: {
                "invitees.$.status": "rewarded",
                "invitees.$.rewarded_at": now,
            },
            $push: {
                rewards: {
                    type: "pro_1_month",
                    triggered_by: newUserObjectId,
                    granted_at: now,
                    pro_extended_until: newProUntil,
                    status: "applied",
                    value_days: REWARD_DAYS,
                },
            },
            $inc: { total_rewards_earned: 1 },
        }
    );

    return {
        rewarded: true,
        referrer_id: referralDoc.user_id,
        reward_type: "pro_1_month",
        pro_extended_until: newProUntil,
        // When you integrate entitlement system later,
        // call entitlements.service.ts here to actually grant Pro
    };
}