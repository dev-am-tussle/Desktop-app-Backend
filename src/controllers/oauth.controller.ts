import { Request, Response } from 'express';
import { OAuthService } from '../services/oauth.service';

const APP_PROTOCOL = process.env.APP_DEEPLINK_PROTOCOL || 'sovereign';

function buildAppRedirect(path: 'auth-success' | 'auth-error', params: Record<string, string>): string {
    const query = new URLSearchParams(params);
    return `${APP_PROTOCOL}://${path}?${query.toString()}`;
}

function renderAuthSuccessPage(redirectUrl: string, provider: string): string {
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sign-in complete</title>
        <style>
            :root { color-scheme: light; }

            body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                font-family: Inter, Segoe UI, Arial, sans-serif;
                background: linear-gradient(135deg, #f6f8ff 0%, #eef4ff 45%, #ffffff 100%);
                color: #172033;
            }

            .card {
                width: min(560px, calc(100vw - 32px));
                background: rgba(255, 255, 255, 0.92);
                border: 1px solid rgba(23, 32, 51, 0.08);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(23, 32, 51, 0.12);
                padding: 32px;
            }

            .badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 999px;
                background: #e8f5ee;
                color: #166534;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 18px;
            }

            h1 {
                margin: 0 0 12px;
                font-size: 34px;
                line-height: 1.1;
            }

            p {
                margin: 0 0 14px;
                font-size: 16px;
                line-height: 1.6;
                color: #4a5568;
            }

            .actions {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
                margin-top: 24px;
            }

            .button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 12px 18px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                border: 1px solid transparent;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .primary {
                background: #111827;
                color: #fff;
            }

            .primary:hover {
                opacity: 0.92;
            }

            .secondary {
                background: transparent;
                border-color: rgba(17, 24, 39, 0.18);
                color: #111827;
            }

            .hint {
                margin-top: 16px;
                font-size: 13px;
                color: #718096;
            }

            code {
                word-break: break-all;
            }
        </style>
    </head>

    <body>
        <main class="card">
            <div class="badge">Authentication successful</div>

            <h1>You're signed in.</h1>

            <p>
                ${provider} sign-in completed successfully. You can now return
                to the Sovereign AI app.
            </p>

            <p>
                If the app does not open automatically, use the button below.
                Your session is already ready.
            </p>

            <div class="actions">
                <a
                    class="button primary"
                    href="${redirectUrl}"
                    id="open-app"
                >
                    Open Sovereign AI (4s)
                </a>

                <button
                    class="button secondary"
                    type="button"
                    id="copy"
                >
                    Copy app payload
                </button>
            </div>

            <div class="hint">
                Automatic handoff will start in a moment. If prompted by the
                browser, allow the app to open.
            </div>
        </main>

        <script>
            const redirectUrl = ${JSON.stringify(redirectUrl)};

            // Copy button
            const copyButton = document.getElementById("copy");

            if (copyButton) {
                copyButton.addEventListener("click", async () => {
                    try {
                        await navigator.clipboard.writeText(redirectUrl);
                        copyButton.textContent = "Copied";
                    } catch (error) {
                        copyButton.textContent = "Copy failed";
                    }
                });
            }

            // Countdown logic
            const openButton = document.getElementById("open-app");

            let countdown = 4;

            const interval = setInterval(() => {
                countdown--;

                if (countdown > 0) {
                    openButton.textContent =
                        \`Open Sovereign AI (\${countdown}s)\`;
                } else {
                    clearInterval(interval);

                    openButton.textContent = "Opening Sovereign AI...";

                    // Auto open app
                    window.location.href = redirectUrl;
                }
            }, 1000);
        </script>
    </body>
</html>`;
}

export class OAuthController {
    // Initiate OAuth flow
    static async initAuth(req: Request, res: Response): Promise<void> {
        try {
            const { provider } = req.body;

            if (!provider || !['google', 'microsoft'].includes(provider)) {
                res.status(400).json({ error: 'Invalid provider' });
                return;
            }

            const authUrl = await OAuthService.getAuthUrl(provider);

            res.json({
                authUrl,
                provider,
                message: 'Redirect user to this URL',
            });
        } catch (error) {
            console.error('Init auth error:', error);
            res.status(500).json({ error: 'Failed to initialize authentication' });
        }
    }

    // Google callback handler
    static async googleCallback(req: Request, res: Response): Promise<void> {
        try {
            const { code, error } = req.query;

            if (error) {
                console.error('OAuth error:', error);
                res.redirect(buildAppRedirect('auth-error', { error: String(error) }));
                return;
            }

            if (!code) {
                res.status(400).send('Missing authorization code');
                return;
            }

            // Exchange code for tokens and create session
            const { user, registrationResponse } = await OAuthService.handleGoogleCallback(code as string);

            const sessionToken = registrationResponse.data.authentication.sessionToken;
            const refreshToken = registrationResponse.data.authentication.refreshToken;
            const userId = user._id.toString();

            // Create a flat payload structure that frontend expects
            const flatPayload = {
                sessionToken,
                refreshToken,
                userId,
                provider: 'google',
                email: user.email,
                name: user.name,
                planType: registrationResponse.data.planType || 'free',
                subscription: registrationResponse.data.subscription
            };

            const payload = Buffer.from(JSON.stringify(flatPayload)).toString('base64url');
            const redirectUrl = buildAppRedirect('auth-success', { payload });

            res.status(200).type('html').send(renderAuthSuccessPage(redirectUrl, 'Google'));
        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect(buildAppRedirect('auth-error', { error: 'authentication_failed' }));
        }
    }

    // Microsoft callback handler (Phase 2)
    static async microsoftCallback(req: Request, res: Response): Promise<void> {
        try {
            const { code, error } = req.query;

            if (error) {
                console.error('Microsoft OAuth error:', error);
                res.redirect(buildAppRedirect('auth-error', { error: String(error) }));
                return;
            }

            if (!code) {
                res.status(400).send('Missing authorization code');
                return;
            }

            const { user, registrationResponse } = await OAuthService.handleMicrosoftCallback(code as string);

            const sessionToken = registrationResponse.data.authentication.sessionToken;
            const refreshToken = registrationResponse.data.authentication.refreshToken;
            const userId = user._id.toString();

            const flatPayload = {
                sessionToken,
                refreshToken,
                userId,
                provider: 'microsoft',
                email: user.email,
                name: user.name,
                planType: registrationResponse.data.planType || 'free',
                subscription: registrationResponse.data.subscription
            };

            const payload = Buffer.from(JSON.stringify(flatPayload)).toString('base64url');
            const redirectUrl = buildAppRedirect('auth-success', { payload });

            res.status(200).type('html').send(renderAuthSuccessPage(redirectUrl, 'Microsoft'));
        } catch (error) {
            console.error('Microsoft callback error:', error);
            res.redirect(buildAppRedirect('auth-error', { error: 'authentication_failed' }));
        }
    }

    // Get session info (polling endpoint for Electron)
    static async getSession(req: Request, res: Response): Promise<void> {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'No session token provided' });
                return;
            }

            const sessionToken = authHeader.substring(7);
            const session = await OAuthService.getSession(sessionToken);

            res.json({
                authenticated: true,
                user: session,
            });
        } catch (error) {
            res.status(401).json({
                authenticated: false,
                error: 'Invalid or expired session',
            });
        }
    }

    static async logout(_req: Request, res: Response): Promise<void> {
        try {
            // Clear any server-side session if needed
            res.json({ success: true, message: 'Logged out successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Logout failed' });
        }
    }
}