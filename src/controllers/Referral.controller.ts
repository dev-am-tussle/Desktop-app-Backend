import { Request, Response } from "express";
import * as referralService from "../services/Referral.service";

// ─── 1. POST /referral/create-code ───────────────────────────────────────────
// Auth: JWT required
// Called when existing user opens referral screen for first time

export const createReferralCode = async (req: Request, res: Response) => {
    try {
        const user_id = (req as any).user?.userId || (req as any).user?.id || (req as any).user?._id;

        if (!user_id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { device_id, platform, app_version } = req.body;

        const result = await referralService.createReferralCode(user_id, {
            device_id,
            platform,
            app_version,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error("[Referral] createReferralCode error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
};

// ─── 2. POST /referral/activate ──────────────────────────────────────────────
// Auth: NOT required — new user may not be registered yet
// Called when new user types a referral code on first launch

export const activateReferralCode = async (req: Request, res: Response) => {
    try {
        const { code, user_id, device_id, platform, app_version } = req.body;

        if (!code || !user_id) {
            return res.status(400).json({
                success: false,
                message: "code and new_user_id are required",
            });
        }

        const result = await referralService.activateReferralCode(
            code,
            user_id,
            { device_id, platform, app_version }
        );

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.reason,
            });
        }

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error("[Referral] activateReferralCode error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
};

// ─── 3. GET /referral/stats ──────────────────────────────────────────────────
// Auth: JWT required
// Powers the referral screen UI — invited count, joined, rewards list

export const getReferralStats = async (req: Request, res: Response) => {
    try {
        const user_id = (req as any).user?.userId || (req as any).user?.id || (req as any).user?._id;

        if (!user_id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const result = await referralService.getReferralStats(user_id);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error("[Referral] getReferralStats error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
};

// ─── 4. POST /referral/reward-trigger ────────────────────────────────────────
// Auth: Internal only — called by chat.controller.ts on user's first message
// Do NOT expose this to the client directly

export const triggerRewardOnFirstChat = async (req: Request, res: Response) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: "new_user_id is required",
            });
        }

        const result = await referralService.triggerRewardOnFirstChat(user_id);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error("[Referral] triggerRewardOnFirstChat error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
};