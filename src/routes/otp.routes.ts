import { Router } from 'express';
import { OTPController } from '../controllers/otp.controller';

const router = Router();

/**
 * POST /api/otp/request
 * Request OTP for email verification
 * Body: { email: string }
 */
router.post('/request', OTPController.requestOTP);

/**
 * POST /api/otp/verify
 * Verify OTP code
 * Body: { email: string, code: string }
 */
router.post('/verify', OTPController.verifyOTP);

/**
 * GET /api/otp/status/:email
 * Check verification status (optional, for debugging)
 */
router.get('/status/:email', OTPController.getStatus);

export default router;
