import { Request, Response } from 'express';
import { OTPService } from '../services/otp.service';

export class OTPController {
    /**
     * POST /api/otp/request
     * Request OTP for email verification
     * Body: { email: string, name: string }
     * Returns: { success, message, expiresInSeconds, userMessage }
     */
    static async requestOTP(req: Request, res: Response): Promise<void> {
        try {
            const { email, name } = req.body;

            // ✅ Validate email
            if (!email || typeof email !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Email is required and must be a string',
                    userMessage: '❌ Please enter your email address.',
                });
                return;
            }

            // ✅ Validate name
            if (!name || typeof name !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Name is required and must be a string',
                    userMessage: '❌ Please enter your full name.',
                });
                return;
            }

            // ✅ Validate name length
            if (name.trim().length < 2 || name.trim().length > 100) {
                res.status(400).json({
                    success: false,
                    error: 'Name must be between 2 and 100 characters',
                    userMessage: '❌ Name must be between 2 and 100 characters.',
                });
                return;
            }

            // ✅ Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid email format',
                    userMessage: '❌ Please enter a valid email address (e.g., user@example.com).',
                });
                return;
            }

            // ✅ Call service with both email and name
            const result = await OTPService.requestOTP(email.trim(), name.trim());

            res.status(200).json({
                success: true,
                message: result.message,
                userMessage: `✅ Verification code sent to ${email.trim()}. Valid for 2 minutes.`,
                expiresInSeconds: result.expiresInSeconds,
            });
        } catch (error: any) {
            console.error('[OTP Controller] Request OTP error:', error);

            // ✅ Handle RATE_LIMITED (429)
            if (error.code === 'RATE_LIMITED') {
                res.status(429).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                    waitSeconds: error.waitSeconds,
                });
                return;
            }

            // ✅ Handle BLOCKED (429)
            if (error.code === 'BLOCKED') {
                res.status(429).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                    waitSeconds: error.waitSeconds,
                });
                return;
            }

            // ✅ Handle ALREADY_VERIFIED (400)
            if (error.code === 'ALREADY_VERIFIED') {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                });
                return;
            }

            // ✅ Handle INVALID_NAME (400)
            if (error.code === 'INVALID_NAME') {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                });
                return;
            }

            // ✅ Handle EMAIL_SEND_FAILED (500)
            if (error.code === 'EMAIL_SEND_FAILED') {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                });
                return;
            }

            // Generic error
            res.status(500).json({
                success: false,
                error: 'Failed to send verification code',
                userMessage: '❌ Something went wrong. Please try again later.',
            });
        }
    }

    /**
     * POST /api/otp/verify
     * Verify OTP code
     * Body: { email: string, code: string }
     * Returns: { success, verified, userMessage, userDisplayName, attemptsRemaining }
     * ✅ Tracks: attempts, expiry, verified status, verifiedAt timestamp
     */
    static async verifyOTP(req: Request, res: Response): Promise<void> {
        try {
            const { email, code } = req.body;

            // ✅ Validate inputs exist
            if (!email || !code) {
                res.status(400).json({
                    success: false,
                    error: 'Email and verification code are required',
                    userMessage: '❌ Please enter both your email and verification code.',
                });
                return;
            }

            // ✅ Validate types
            if (typeof email !== 'string' || typeof code !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Email and code must be strings',
                    userMessage: '❌ Invalid input format.',
                });
                return;
            }

            // ✅ Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid email format',
                    userMessage: '❌ Please enter a valid email address.',
                });
                return;
            }

            // ✅ Code format validation (must be 6 digits)
            if (!/^\d{6}$/.test(code.trim())) {
                res.status(400).json({
                    success: false,
                    error: 'Verification code must be exactly 6 digits',
                    userMessage: '❌ Verification code must be exactly 6 digits.',
                });
                return;
            }

            // ✅ Call service to verify (handles all tracking)
            const result = await OTPService.verifyOTP(email.trim(), code.trim());

            res.status(200).json({
                success: true,
                verified: result.verified,
                message: 'Email verified successfully',
                userMessage: result.userMessage,
                userDisplayName: result.userDisplayName,
            });
        } catch (error: any) {
            console.error('[OTP Controller] Verify OTP error:', error);

            // ✅ Handle NOT_FOUND (400)
            if (error.code === 'NOT_FOUND') {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                });
                return;
            }

            // ✅ Handle BLOCKED (429)
            if (error.code === 'BLOCKED') {
                res.status(429).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                    waitSeconds: error.waitSeconds,
                    attemptsRemaining: error.attemptsRemaining || 0,
                });
                return;
            }

            // ✅ Handle EXPIRED (400)
            if (error.code === 'EXPIRED') {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                });
                return;
            }

            // ✅ Handle INVALID_FORMAT (400)
            if (error.code === 'INVALID_FORMAT') {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                    attemptsRemaining: error.attemptsRemaining || 0,
                });
                return;
            }

            // ✅ Handle INVALID_CODE (400) - with attempts tracking
            if (error.code === 'INVALID_CODE') {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    userMessage: error.userMessage,
                    attemptsRemaining: error.attemptsRemaining,
                });
                return;
            }

            // Generic error
            res.status(500).json({
                success: false,
                error: 'Failed to verify code',
                userMessage: '❌ Verification failed. Please try again.',
            });
        }
    }

    /**
     * GET /api/otp/status/:email
     * Check verification status for an email (DEBUG endpoint)
     * Returns: { isVerified, isPending, isBlocked, verifiedAt, attemptsRemaining }
     */
    static async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.params;

            if (!email) {
                res.status(400).json({
                    success: false,
                    error: 'Email is required',
                });
                return;
            }

            const status = await OTPService.getVerificationStatus(email.trim());

            res.status(200).json({
                success: true,
                email: email.trim(),
                status,
            });
        } catch (error: any) {
            console.error('[OTP Controller] Get status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get verification status',
            });
        }
    }
}
