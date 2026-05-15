import EmailVerification from '../models/EmailVerification.model';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const OTP_LENGTH = 6;
const OTP_VALIDITY_MINUTES = parseInt(process.env.OTP_VALIDITY_MINUTES || '5');
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');
const OTP_COOLDOWN_SECONDS = parseInt(process.env.OTP_COOLDOWN_SECONDS || '60');
const OTP_BLOCK_DURATION_MINUTES = parseInt(process.env.OTP_BLOCK_DURATION_MINUTES || '15');

export class OTPService {
    /**
     * Generate a random 6-digit OTP
     */
    static generateOTP(): string {
        const otp = Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(OTP_LENGTH, '0');
        return otp;
    }

    /**
     * Send OTP via SendGrid email
     */
    static async sendOTPEmail(email: string, name: string, otp: string): Promise<void> {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Email Verification - Sovereign AI</title>

    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        table {
            border-spacing: 0;
            border-collapse: collapse;
        }

        img {
            border: 0;
            display: block;
            outline: none;
            text-decoration: none;
        }

        .wrapper {
            width: 100%;
            background-color: #f1f5f9;
            padding: 30px 0;
        }

        .container {
            width: 100%;
            max-width: 600px;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
        }

        .header {
            background-color: #0f172a;
            padding: 40px 30px;
            text-align: center;
            border-bottom: 4px solid #14b8a6;
        }

        .logo {
            width: 52px;
            height: 52px;
            margin: 0 auto 18px auto;
        }

        .title {
            color: #ffffff;
            font-size: 30px;
            font-weight: bold;
            margin: 0;
            line-height: 38px;
        }

        .subtitle {
            color: #cbd5e1;
            font-size: 13px;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-top: 10px;
        }

        .content {
            padding: 40px 35px;
        }

        .greeting {
            font-size: 18px;
            color: #0f172a;
            margin-bottom: 20px;
            font-weight: bold;
        }

        .name {
            color: #14b8a6;
        }

        .description {
            font-size: 15px;
            line-height: 26px;
            color: #475569;
            margin-bottom: 35px;
        }

        .otp-label {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 14px;
        }

        .otp-box {
            border: 2px solid #14b8a6;
            background-color: #f0fdfa;
            border-radius: 10px;
            padding: 28px 20px;
            text-align: center;
        }

        .otp-code {
            font-size: 46px;
            line-height: 52px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #0f172a;
            font-family: Consolas, Monaco, monospace;
        }

        .otp-note {
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            margin-top: 12px;
            font-style: italic;
        }

        .info-box {
            margin-top: 35px;
            background-color: #f8fafc;
            border-left: 4px solid #14b8a6;
            padding: 20px;
            border-radius: 6px;
        }

        .info-title {
            font-size: 15px;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 14px;
        }

        .info-text {
            font-size: 14px;
            line-height: 24px;
            color: #475569;
            margin: 0;
        }

        .support {
            margin-top: 35px;
            padding-top: 25px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
        }

        .support-text {
            font-size: 14px;
            color: #475569;
        }

        .support-link {
            color: #14b8a6;
            text-decoration: none;
            font-weight: bold;
        }

        .footer {
            background-color: #0f172a;
            padding: 30px 20px;
            text-align: center;
        }

        .footer-text {
            color: #cbd5e1;
            font-size: 12px;
            line-height: 22px;
        }

        .footer-link {
            color: #14b8a6;
            text-decoration: none;
        }

        .copyright {
            color: #64748b;
            font-size: 11px;
            margin-top: 12px;
        }

        @media screen and (max-width: 600px) {
            .content {
                padding: 30px 20px !important;
            }

            .otp-code {
                font-size: 34px !important;
                letter-spacing: 4px !important;
            }

            .title {
                font-size: 24px !important;
            }
        }
    </style>
</head>

<body>
    <div class="wrapper">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
                <td align="center">

                    <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation">

                        <!-- HEADER -->
                        <tr>
                            <td class="header">

                                <img
                                    class="logo"
                                    src="https://sovereignai.app/wp-content/uploads/2026/02/sovereignAI-Teal-square-1.webp"
                                    alt="Sovereign AI"
                                    width="52"
                                >

                                <div class="title">
                                    Email Verification
                                </div>

                                <div class="subtitle">
                                    Secure Your Account
                                </div>

                            </td>
                        </tr>

                        <!-- CONTENT -->
                        <tr>
                            <td class="content">

                                <div class="greeting">
                                    Hello <span class="name">${name}</span>! 👋
                                </div>

                                <div class="description">
                                    Welcome to <strong>Sovereign AI</strong>! We received a request to verify your email address.
                                    This is the final step to activate your account and unlock full access to our platform.
                                </div>

                                <!-- OTP -->
                                <div class="otp-label">
                                    Your Verification Code
                                </div>

                                <div class="otp-box">
                                    <div class="otp-code">
                                        ${otp}
                                    </div>
                                </div>

                                <div class="otp-note">
                                    Enter this code in the app to continue
                                </div>

                                <!-- SECURITY INFO -->
                                <div class="info-box">

                                    <div class="info-title">
                                        🔒 Security Information
                                    </div>

                                    <div class="info-text">
                                        • This code is valid for <strong>${OTP_VALIDITY_MINUTES} minutes</strong><br>
                                        • Never share this code with anyone<br>
                                        • Each verification code can only be used once<br>
                                        • If you didn’t request this email, you can safely ignore it
                                    </div>

                                </div>

                                <!-- SUPPORT -->
                                <div class="support">

                                    <div class="support-text">
                                        Need help?
                                        <a
                                            href="mailto:support@sovereignai.group"
                                            class="support-link"
                                        >
                                            Contact our support team
                                        </a>
                                    </div>

                                </div>

                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td class="footer">

                                <div class="footer-text">
                                    © 2026 Sovereign AI. All rights reserved.<br>
                                    Empowering autonomous intelligence responsibly
                                </div>

                                <div style="margin-top:16px;" class="footer-text">
                                    <a href="https://sovereignai.group/terms" class="footer-link">
                                        Terms of Service
                                    </a>

                                    &nbsp;&nbsp;•&nbsp;&nbsp;

                                    <a href="https://sovereignai.group/privacy" class="footer-link">
                                        Privacy Policy
                                    </a>

                                    &nbsp;&nbsp;•&nbsp;&nbsp;

                                    <a href="https://sovereignai.group/privacy" class="footer-link">
                                        Security
                                    </a>
                                </div>

                                <div class="copyright">
                                    This is an automated security message. Please do not reply to this email.
                                </div>

                            </td>
                        </tr>

                    </table>

                </td>
            </tr>
        </table>
    </div>
</body>
</html>
        `;

        try {
            await sgMail.send({
                to: email,
                from: process.env.OTP_SENDER_EMAIL!,
                subject: `Your Sovereign AI Verification Code: ${otp}`,
                html: htmlContent,
            });
            console.log(`[OTP] Email sent successfully to ${email}`);
        } catch (error) {
            console.error(`[OTP] Failed to send email to ${email}:`, error);
            throw new Error('Failed to send verification email');
        }
    }

    /**
     * Request OTP for email verification
     * Validates email, name, rate limiting, and blocking
     * Returns expiration time if successful
     */
    static async requestOTP(
        email: string,
        name: string
    ): Promise<{ success: boolean; message: string; expiresInSeconds: number }> {
        const emailLower = email.toLowerCase().trim();
        const nameTrimmed = name.trim();

        // ✅ Validate name
        if (!nameTrimmed || nameTrimmed.length < 2 || nameTrimmed.length > 100) {
            throw {
                code: 'INVALID_NAME',
                message: 'Name must be between 2 and 100 characters',
                userMessage: 'Please enter a valid name (2-100 characters)',
            };
        }

        // ✅ Check if user already verified
        const existingVerified = await EmailVerification.findOne({
            email: emailLower,
            isVerified: true,
        });

        if (existingVerified) {
            throw {
                code: 'ALREADY_VERIFIED',
                message: 'Email already verified',
                userMessage: 'This email has already been verified. If you need to re-verify, please contact support.',
            };
        }

        // ✅ Check for existing pending verification
        const existing = await EmailVerification.findOne({
            email: emailLower,
            isVerified: false,
        });

        // ✅ Check if blocked due to too many failed attempts
        if (existing?.blockedUntil && existing.blockedUntil > new Date()) {
            const waitSeconds = Math.ceil(
                (existing.blockedUntil.getTime() - Date.now()) / 1000
            );
            const waitMinutes = Math.ceil(waitSeconds / 60);
            throw {
                code: 'BLOCKED',
                message: `Account temporarily blocked. Try again in ${waitMinutes} minutes.`,
                userMessage: `🔒 Account temporarily locked due to too many failed attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`,
                waitSeconds,
            };
        }

        // ✅ Check rate limiting (1 OTP request per minute)
        if (existing && !existing.blockedUntil) {
            const timeSinceCreated = (Date.now() - existing.createdAt.getTime()) / 1000;
            if (timeSinceCreated < OTP_COOLDOWN_SECONDS) {
                const waitSeconds = Math.ceil(OTP_COOLDOWN_SECONDS - timeSinceCreated);
                throw {
                    code: 'RATE_LIMITED',
                    message: `Please wait ${waitSeconds}s before requesting another OTP`,
                    userMessage: `⏳ Please wait ${waitSeconds} second${waitSeconds > 1 ? 's' : ''} before requesting another verification code.`,
                    waitSeconds,
                };
            }
        }

        // ✅ Generate new OTP
        const otp = this.generateOTP();
        const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

        // ✅ Send email
        try {
            await this.sendOTPEmail(emailLower, nameTrimmed, otp);
        } catch (error) {
            console.error(`[OTP] Failed to send email to ${emailLower}:`, error);
            throw {
                code: 'EMAIL_SEND_FAILED',
                message: 'Failed to send verification email',
                userMessage: 'We could not send the verification code to your email. Please check your email address and try again.',
            };
        }

        // ✅ Save/update verification record in MongoDB
        if (existing) {
            // Update existing record
            existing.code = otp;
            existing.name = nameTrimmed;
            existing.attempts = 0;
            existing.blockedUntil = undefined;
            existing.expiresAt = expiresAt;
            await existing.save();
            console.log(`[OTP] OTP re-requested for ${emailLower}. Expires in ${OTP_VALIDITY_MINUTES} minutes.`);
        } else {
            // Create new record ✅ Saved to MongoDB
            await EmailVerification.create({
                email: emailLower,
                name: nameTrimmed,
                code: otp,
                attempts: 0,
                expiresAt,
                isVerified: false,
            });
            console.log(
                `[OTP] New OTP created for ${emailLower} (${nameTrimmed}). Expires in ${OTP_VALIDITY_MINUTES} minutes.`
            );
        }

        return {
            success: true,
            message: `Verification code sent to ${emailLower}`,
            expiresInSeconds: OTP_VALIDITY_MINUTES * 60,
        };
    }

    /**
     * Verify OTP code
     * ✅ Tracks: attempts, expiry, verified status, verifiedAt timestamp
     * Validates: email exists, code matches, not expired, attempts not exceeded
     */
    static async verifyOTP(
        email: string,
        code: string
    ): Promise<{
        success: boolean;
        verified: boolean;
        userMessage?: string;
        userDisplayName?: string;
    }> {
        const emailLower = email.toLowerCase().trim();
        const codeTrimmed = code.trim();

        // ✅ Find verification record (tracks all attempts & expiry)
        const verification = await EmailVerification.findOne({
            email: emailLower,
            isVerified: false,
        });

        if (!verification) {
            throw {
                code: 'NOT_FOUND',
                message: 'No pending verification found',
                userMessage: '❌ No verification found for this email. Please request a new verification code.',
            };
        }

        // ✅ Check if blocked due to too many attempts
        if (verification.blockedUntil && verification.blockedUntil > new Date()) {
            const waitSeconds = Math.ceil(
                (verification.blockedUntil.getTime() - Date.now()) / 1000
            );
            const waitMinutes = Math.ceil(waitSeconds / 60);
            throw {
                code: 'BLOCKED',
                message: `Too many attempts. Blocked until ${verification.blockedUntil.toISOString()}`,
                userMessage: `🔒 Too many failed attempts. Your account is temporarily locked. Try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`,
                waitSeconds,
                attemptsRemaining: 0,
            };
        }

        // ✅ Check if OTP is expired (validation against expiresAt)
        if (verification.expiresAt < new Date()) {
            await EmailVerification.deleteOne({ _id: verification._id });
            throw {
                code: 'EXPIRED',
                message: 'OTP expired',
                userMessage: `⏰ Your verification code has expired. Please request a new code.`,
            };
        }

        // ✅ Validate code format (6 digits)
        if (!/^\d{6}$/.test(codeTrimmed)) {
            throw {
                code: 'INVALID_FORMAT',
                message: 'Code must be 6 digits',
                userMessage: '❌ Verification code must be exactly 6 digits.',
                attemptsRemaining: OTP_MAX_ATTEMPTS - verification.attempts,
            };
        }

        // ✅ Check if code matches
        if (verification.code !== codeTrimmed) {
            // Increment attempts ✅ Track attempts
            verification.attempts += 1;

            // Check if max attempts exceeded ✅ Blocking logic
            if (verification.attempts >= OTP_MAX_ATTEMPTS) {
                verification.blockedUntil = new Date(
                    Date.now() + OTP_BLOCK_DURATION_MINUTES * 60 * 1000
                );
                await verification.save();
                console.log(
                    `[OTP] User ${emailLower} blocked for ${OTP_BLOCK_DURATION_MINUTES} minutes after ${verification.attempts} failed attempts`
                );
                throw {
                    code: 'BLOCKED',
                    message: `Max attempts exceeded. Blocked for ${OTP_BLOCK_DURATION_MINUTES} minutes`,
                    userMessage: `🔒 Too many incorrect attempts. Your account is locked for ${OTP_BLOCK_DURATION_MINUTES} minutes for security.`,
                    waitSeconds: OTP_BLOCK_DURATION_MINUTES * 60,
                    attemptsRemaining: 0,
                };
            }

            await verification.save();
            const attemptsRemaining = OTP_MAX_ATTEMPTS - verification.attempts;
            console.log(
                `[OTP] Invalid code for ${emailLower}. Attempts: ${verification.attempts}/${OTP_MAX_ATTEMPTS}`
            );
            throw {
                code: 'INVALID_CODE',
                message: `Invalid OTP code. ${attemptsRemaining} attempts remaining`,
                userMessage: `❌ Incorrect verification code. You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.`,
                attemptsRemaining,
            };
        }

        // ✅ Mark as verified with timestamp
        verification.isVerified = true;
        verification.verifiedAt = new Date(); // ✅ Track when verified
        verification.attempts = 0;
        verification.blockedUntil = undefined;
        await verification.save();

        console.log(
            `[OTP] ✅ Email ${emailLower} verified successfully at ${verification.verifiedAt.toISOString()}`
        );

        return {
            success: true,
            verified: true,
            userDisplayName: verification.name,
            userMessage: `✅ Email verified successfully! Welcome ${verification.name}!`,
        };
    }

    /**
     * Check if email is verified
     */
    static async isEmailVerified(email: string): Promise<boolean> {
        const emailLower = email.toLowerCase().trim();
        const verification = await EmailVerification.findOne({
            email: emailLower,
            isVerified: true,
        });
        return !!verification;
    }

    /**
     * Get verification status for an email
     */
    static async getVerificationStatus(email: string): Promise<{
        isVerified: boolean;
        expiresAt?: Date;
        attemptsRemaining?: number;
        blockedUntil?: Date;
    }> {
        const emailLower = email.toLowerCase().trim();
        const verification = await EmailVerification.findOne({
            email: emailLower,
        });

        if (!verification) {
            return { isVerified: false };
        }

        return {
            isVerified: verification.isVerified,
            expiresAt: verification.expiresAt,
            attemptsRemaining: verification.isVerified ? undefined : OTP_MAX_ATTEMPTS - verification.attempts,
            blockedUntil: verification.blockedUntil,
        };
    }

    /**
     * Clear verification for email (used during cleanup or account deletion)
     */
    static async clearVerification(email: string): Promise<void> {
        const emailLower = email.toLowerCase().trim();
        await EmailVerification.deleteOne({ email: emailLower });
        console.log(`[OTP] Verification cleared for ${emailLower}`);
    }
}
