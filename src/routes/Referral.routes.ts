import { Router } from "express";
import { authenticateToken } from "../middleware/auth"; // your existing JWT middleware
import {
    createReferralCode,
    activateReferralCode,
    getReferralStats,
    triggerRewardOnFirstChat,
} from "../controllers/Referral.controller";

const router = Router();

// ─── Public (no auth) ─────────────────────────────────────────────────────────

// New user enters referral code on first launch
router.post("/activate", activateReferralCode);

// ─── Protected (JWT required) ─────────────────────────────────────────────────

// Existing user opens referral screen — get or create their code
router.post("/create-code", authenticateToken, createReferralCode);

// Existing user views referral stats
router.get("/stats", authenticateToken, getReferralStats);

// ─── Internal (called by chat.controller only) ────────────────────────────────
// NOTE: In production, protect this with an internal secret header
// or call triggerRewardOnFirstChat() directly from chat.service instead of HTTP

router.post("/reward-trigger", triggerRewardOnFirstChat);

export default router;