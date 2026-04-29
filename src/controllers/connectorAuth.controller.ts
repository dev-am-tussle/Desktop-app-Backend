import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { AppError } from '../middleware/errorHandler';
import { McpConnector, User } from '../models';
import ConnectorAuthSession from '../models/ConnectorAuthSession.model';

type AuthCategory =
    | 'oauth2_authorization_code'
    | 'oauth2_client_credentials'
    | 'api_key'
    | 'personal_access_token'
    | 'basic_auth'
    | 'none';

type AuthExecutionType = 'redirect' | 'form' | 'none' | 'device_code';

interface NormalizedAuthContract {
    category: AuthCategory;
    execution: AuthExecutionType;
    sessionRequired: boolean;
    oauth?: {
        provider?: string;
        flow?: 'authorization_code' | 'pkce' | 'device_code';
        authorizationUrl?: string;
        tokenUrl?: string;
        scopes?: string[];
        pkceRequired?: boolean;
        redirectUri?: string;
    };
    ui?: {
        type?: AuthExecutionType;
        instructions?: string;
    };
    tokenLifecycle?: {
        autoRefresh: boolean;
        expiryBufferSeconds: number;
    };
}

function getPortalOrigin(): string {
    const origin = process.env.AUTH_PORTAL_ORIGIN?.trim();

    if (!origin) {
        throw new AppError('AUTH_PORTAL_ORIGIN is not configured', 500, 'CONFIGURATION_ERROR');
    }

    try {
        return new URL(origin).toString().replace(/\/$/, '');
    } catch {
        throw new AppError('AUTH_PORTAL_ORIGIN must be a valid absolute URL', 500, 'CONFIGURATION_ERROR');
    }
}

function buildAuthUrl(portalOrigin: string, connectorId: string, sessionId: string, state: string): string {
    const url = new URL(`/connectors/${connectorId}/auth`, portalOrigin);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('state', state);
    return url.toString();
}

function buildRedirectUriUrl(): string {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000/api';
    return `${backendUrl.replace(/\/$/, '')}/auth/handle/google`;
}

function createPkcePair(): { codeVerifier: string; codeChallenge: string; codeChallengeMethod: 'S256' } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    return {
        codeVerifier,
        codeChallenge,
        codeChallengeMethod: 'S256',
    };
}

function buildGoogleAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
    codeChallengeMethod?: 'S256';
}): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', params.scopes.join(' '));
    url.searchParams.set('state', params.state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');

    if (params.codeChallenge && params.codeChallengeMethod) {
        url.searchParams.set('code_challenge', params.codeChallenge);
        url.searchParams.set('code_challenge_method', params.codeChallengeMethod);
    }

    return url.toString();
}

function inferAuthContractFromLegacyConnector(connector: any): NormalizedAuthContract {
    const envKeys: string[] = (connector.runtime?.envVarsMetadata || [])
        .map((item: any) => String(item.key || '').toUpperCase());

    if (envKeys.includes('GOOGLE_CLIENT_ID') || envKeys.includes('GOOGLE_CLIENT_SECRET')) {
        return {
            category: 'oauth2_authorization_code',
            execution: 'redirect',
            sessionRequired: true,
            oauth: {
                provider: 'google',
                flow: 'pkce',
                authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                scopes: connector.permissions || [],
                pkceRequired: true,
            },
            ui: {
                type: 'redirect',
            },
            tokenLifecycle: {
                autoRefresh: true,
                expiryBufferSeconds: 300,
            },
        };
    }

    if (envKeys.some((key) => key.includes('PERSONAL_ACCESS_TOKEN') || key.includes('_PAT') || key.includes('GITHUB_PERSONAL_ACCESS_TOKEN'))) {
        return {
            category: 'personal_access_token',
            execution: 'form',
            sessionRequired: false,
            ui: {
                type: 'form',
                instructions: 'Provide your personal access token to connect this tool.',
            },
            tokenLifecycle: {
                autoRefresh: false,
                expiryBufferSeconds: 300,
            },
        };
    }

    if (envKeys.some((key) => key.includes('API_KEY'))) {
        return {
            category: 'api_key',
            execution: 'form',
            sessionRequired: false,
            ui: {
                type: 'form',
                instructions: 'Enter API key credentials to connect this tool.',
            },
            tokenLifecycle: {
                autoRefresh: false,
                expiryBufferSeconds: 300,
            },
        };
    }

    if (envKeys.some((key) => key.includes('USERNAME')) || envKeys.some((key) => key.includes('PASSWORD'))) {
        return {
            category: 'basic_auth',
            execution: 'form',
            sessionRequired: false,
            ui: {
                type: 'form',
                instructions: 'Provide username and password to connect this tool.',
            },
            tokenLifecycle: {
                autoRefresh: false,
                expiryBufferSeconds: 300,
            },
        };
    }

    if (envKeys.length === 0) {
        return {
            category: 'none',
            execution: 'none',
            sessionRequired: false,
            ui: {
                type: 'none',
            },
            tokenLifecycle: {
                autoRefresh: false,
                expiryBufferSeconds: 300,
            },
        };
    }

    return {
        category: 'api_key',
        execution: 'form',
        sessionRequired: false,
        ui: {
            type: 'form',
            instructions: 'Provide connector credentials to continue.',
        },
        tokenLifecycle: {
            autoRefresh: false,
            expiryBufferSeconds: 300,
        },
    };
}

function getNormalizedAuthContract(connector: any): NormalizedAuthContract {
    const contract = connector.auth;

    if (!contract || !contract.category) {
        return inferAuthContractFromLegacyConnector(connector);
    }

    const category = contract.category as AuthCategory;
    const isOAuthCategory = category === 'oauth2_authorization_code' || category === 'oauth2_client_credentials';

    return {
        category,
        execution: (contract.execution as AuthExecutionType) || (isOAuthCategory ? 'redirect' : category === 'none' ? 'none' : 'form'),
        sessionRequired: contract.sessionRequired ?? isOAuthCategory,
        oauth: contract.oauth
            ? {
                provider: contract.oauth.provider || undefined,
                flow: contract.oauth.flow || (category === 'oauth2_authorization_code' ? 'pkce' : undefined),
                authorizationUrl: contract.oauth.authorizationUrl || (contract.oauth.provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : undefined),
                tokenUrl: contract.oauth.tokenUrl || (contract.oauth.provider === 'google' ? 'https://oauth2.googleapis.com/token' : undefined),
                scopes: contract.oauth.scopes || connector.permissions || [],
                pkceRequired: contract.oauth.pkceRequired ?? (category === 'oauth2_authorization_code'),
                redirectUri: contract.oauth.redirectUriEnvKey ? process.env[contract.oauth.redirectUriEnvKey] || undefined : undefined,
            }
            : undefined,
        ui: {
            type: (contract.ui?.type as AuthExecutionType) || (contract.execution as AuthExecutionType) || undefined,
            instructions: contract.ui?.instructions || undefined,
        },
        tokenLifecycle: {
            autoRefresh: contract.tokenLifecycle?.autoRefresh ?? isOAuthCategory,
            expiryBufferSeconds: contract.tokenLifecycle?.expiryBufferSeconds ?? 300,
        },
    };
}

function getResolvedOAuthProvider(connector: any, authContract: NormalizedAuthContract): string | null {
    if (authContract.oauth?.provider) {
        return authContract.oauth.provider;
    }

    const normalizedName = String(connector.name || '').toLowerCase();
    const normalizedTitle = String(connector.title || '').toLowerCase();

    if (normalizedName === 'gmail' || normalizedName === 'google' || normalizedTitle.includes('google')) {
        return 'google';
    }

    return null;
}

function buildAuthExecution(authContract: NormalizedAuthContract, authUrl: string, sessionId: string, redirectUri?: string) {
    if (authContract.execution === 'none') {
        return {
            type: 'none' as const,
            sessionId,
        };
    }

    if (authContract.execution === 'form') {
        return {
            type: 'form' as const,
            method: 'GET' as const,
            url: authUrl,
            target: '_self' as const,
            sessionId,
        };
    }

    if (authContract.execution === 'device_code') {
        return {
            type: 'device_code' as const,
            method: 'GET' as const,
            url: authUrl,
            target: '_self' as const,
            sessionId,
        };
    }

    return {
        type: 'redirect' as const,
        method: 'GET' as const,
        url: authUrl,
        target: '_self' as const,
        sessionId,
        redirectUri: redirectUri || authContract.oauth?.redirectUri,
    };
}

function encryptSecret(value: string): string {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
        throw new AppError('ENCRYPTION_KEY is not configured', 500, 'CONFIGURATION_ERROR');
    }

    return CryptoJS.AES.encrypt(value, encryptionKey).toString();
}

async function exchangeGoogleOAuthCode(code: string, redirectUri: string, codeVerifier?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new AppError('Google OAuth client credentials are not configured', 500, 'CONFIGURATION_ERROR');
    }

    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const bodyParams: any = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    };

    if (codeVerifier) {
        bodyParams.code_verifier = codeVerifier;
    }

    const body = new URLSearchParams(bodyParams);

    const response = await axios.post(tokenEndpoint, body.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return response.data as {
        access_token: string;
        refresh_token?: string;
        id_token?: string;
        token_type?: string;
        scope?: string;
        expires_in?: number;
    };
}

async function exchangeOAuthCodeByProvider(provider: string, code: string, redirectUri: string, codeVerifier?: string) {
    switch (provider) {
        case 'google':
            return exchangeGoogleOAuthCode(code, redirectUri, codeVerifier);
        default:
            throw new AppError(`OAuth callback handler not implemented for provider: ${provider}`, 501, 'OAUTH_PROVIDER_NOT_IMPLEMENTED');
    }
}

/**
 * POST /api/auth/create-session
 * Create a short-lived connector auth session for the desktop app
 */
export const createConnectorAuthSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const { connectorId, deviceId, platform, redirectUri } = req.body;

        if (!userId) {
            throw new AppError('User authentication required', 401, 'AUTH_REQUIRED');
        }

        const connector = await McpConnector.findOne({ _id: connectorId, isArchived: false });
        if (!connector) {
            throw new AppError('Connector not found', 404, 'CONNECTOR_NOT_FOUND');
        }

        const portalOrigin = getPortalOrigin();
        const sessionId = crypto.randomUUID();
        const state = crypto.randomBytes(32).toString('hex');
        const nonce = crypto.randomBytes(32).toString('hex');
        const finalRedirectUri = redirectUri || buildRedirectUriUrl();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const authContract = getNormalizedAuthContract(connector);
        const oauthProvider = getResolvedOAuthProvider(connector, authContract);
        const authMethod = authContract.category.startsWith('oauth2') ? 'oauth2' : 'manual';
        const pkcePair = authContract.oauth?.pkceRequired ? createPkcePair() : null;

        if (authContract.category.startsWith('oauth2') && !oauthProvider) {
            throw new AppError('OAuth connector is missing provider configuration', 500, 'CONFIGURATION_ERROR');
        }

        const providerAuthorizationUrl = authContract.category.startsWith('oauth2') && oauthProvider === 'google'
            ? buildGoogleAuthorizationUrl({
                clientId: process.env.GOOGLE_CLIENT_ID || '',
                redirectUri: finalRedirectUri,
                state,
                scopes: authContract.oauth?.scopes || connector.permissions || [],
                codeChallenge: pkcePair?.codeChallenge,
                codeChallengeMethod: pkcePair?.codeChallengeMethod,
            })
            : null;

        const portalAuthUrl = buildAuthUrl(portalOrigin, connector._id.toString(), sessionId, state);

        const authExecution = buildAuthExecution(
            authContract,
            providerAuthorizationUrl || portalAuthUrl,
            sessionId,
            finalRedirectUri
        );

        const isNoAuthFlow = authContract.category === 'none';

        if (authContract.category.startsWith('oauth2') && oauthProvider === 'google' && !process.env.GOOGLE_CLIENT_ID) {
            throw new AppError('GOOGLE_CLIENT_ID is not configured', 500, 'CONFIGURATION_ERROR');
        }

        const session = await ConnectorAuthSession.create({
            sessionId,
            userId,
            connectorId: connector._id,
            connectorName: connector.name,
            connectorTitle: connector.title,
            authMethod,
            provider: oauthProvider || undefined,
            codeVerifier: pkcePair?.codeVerifier,
            codeChallenge: pkcePair?.codeChallenge,
            codeChallengeMethod: pkcePair?.codeChallengeMethod,
            status: isNoAuthFlow ? 'authenticated' : 'created',
            state,
            nonce,
            authUrl: providerAuthorizationUrl || portalAuthUrl,
            portalOrigin,
            redirectUri: finalRedirectUri,
            deviceId: deviceId || null,
            platform: platform || null,
            expiresAt,
        });

        console.log('✅ Session created:', {
            sessionId: session.sessionId,
            hasCodeVerifier: !!session.codeVerifier,
            pkceRequired: authContract.oauth?.pkceRequired,
            authUrl: authExecution.url
        });

        res.status(201).json({
            status: 'success',
            message: 'Connector auth session created',
            data: {
                sessionId: session.sessionId,
                state: session.state,
                nonce: session.nonce,
                authUrl: session.authUrl,
                portalAuthUrl,
                providerAuthUrl: providerAuthorizationUrl,
                expiresAt: session.expiresAt.toISOString(),
                authExecution,
                redirectUri: session.redirectUri,
                connector: {
                    id: connector._id,
                    name: connector.name,
                    title: connector.title,
                    version: connector.version,
                    descriptionFormat: connector.descriptionFormat,
                    detailedDescriptionFormat: connector.detailedDescriptionFormat,
                    status: connector.status,
                },
                sessionStatus: session.status,
                authMethod: session.authMethod,
                provider: session.provider || oauthProvider,
                authCategory: authContract.category,
                tokenLifecycle: authContract.tokenLifecycle,
                pkce: pkcePair ? { codeChallengeMethod: pkcePair.codeChallengeMethod } : undefined,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/session/:sessionId/verify
 * Validate auth session ownership + integrity before portal proceeds
 */
export const verifyConnectorAuthSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sessionId } = req.params;
        const { state } = req.query;

        const userId = req.user?.userId;
        const adminId = req.admin?.adminId;

        if (!sessionId || !state) {
            throw new AppError('sessionId and state are required', 400, 'VALIDATION_ERROR');
        }

        const session = await ConnectorAuthSession.findOne({ sessionId }).select('+codeVerifier +codeChallenge +codeChallengeMethod');

        if (!session) {
            throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
        }

        if (session.state !== state) {
            throw new AppError('Invalid state parameter. Security challenge failed.', 403, 'INVALID_STATE');
        }

        if (!adminId && session.userId.toString() !== userId) {
            throw new AppError('Unauthorized: Session belongs to another user', 403, 'UNAUTHORIZED_ACCESS');
        }

        if (new Date() > session.expiresAt) {
            session.status = 'expired';
            await session.save();
            throw new AppError('Session has expired', 410, 'SESSION_EXPIRED');
        }

        if (session.status !== 'created' && session.status !== 'pending') {
            throw new AppError(`Session is in an invalid state: ${session.status}`, 400, 'INVALID_SESSION_STATUS');
        }

        const contextEndpoint = `/auth/session/${session.sessionId}/context`;

        res.status(200).json({
            status: 'success',
            data: {
                valid: true,
                sessionId: session.sessionId,
                status: session.status,
                expiresAt: session.expiresAt,
                isExpired: false,
                contextEndpoint,
                portalAuthUrl: buildAuthUrl(getPortalOrigin(), String(session.connectorId), session.sessionId, session.state),
                providerAuthUrl: session.authUrl,
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/session/:sessionId/context
 * Returns connector + auth contract + user context for rendering portal UI
 */
export const getConnectorAuthSessionContext = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sessionId } = req.params;
        const { state } = req.query;
        const userId = req.user?.userId;
        const adminId = req.admin?.adminId;

        if (!sessionId || !state) {
            throw new AppError('sessionId and state are required', 400, 'VALIDATION_ERROR');
        }

        const session = await ConnectorAuthSession
            .findOne({ sessionId })
            .select('+codeVerifier +codeChallenge +codeChallengeMethod');

        if (!session) {
            throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
        }

        if (session.state !== state) {
            throw new AppError('Invalid state parameter. Security challenge failed.', 403, 'INVALID_STATE');
        }

        if (!adminId && session.userId.toString() !== userId) {
            throw new AppError('Unauthorized: Session belongs to another user', 403, 'UNAUTHORIZED_ACCESS');
        }

        if (new Date() > session.expiresAt) {
            session.status = 'expired';
            await session.save();
            throw new AppError('Session has expired', 410, 'SESSION_EXPIRED');
        }

        const connector = await McpConnector.findById(session.connectorId);
        if (!connector || connector.isArchived) {
            throw new AppError('Connector is no longer available', 404, 'CONNECTOR_UNAVAILABLE');
        }

        const sessionOwner = await User.findById(session.userId)
            .select('name email status role plan_id subscription_status onboardingPhase')
            .lean();

        if (!sessionOwner) {
            throw new AppError('Session owner not found', 404, 'USER_NOT_FOUND');
        }

        const authContract = getNormalizedAuthContract(connector);

        const providerAuthUrl = session.authUrl;

        const authExecution = buildAuthExecution(
            authContract,
            providerAuthUrl,
            session.sessionId,
            session.redirectUri
        );

        res.status(200).json({
            status: 'success',
            data: {
                session: {
                    id: session.sessionId,
                    status: session.status,
                    expiresAt: session.expiresAt,
                    platform: session.platform,
                    deviceId: session.deviceId,
                    portalOrigin: session.portalOrigin,
                    redirectUri: session.redirectUri,
                },
                connector: {
                    id: connector._id,
                    name: connector.name,
                    title: connector.title,
                    description: connector.description,
                    descriptionFormat: connector.descriptionFormat,
                    detailedDescription: connector.detailedDescription,
                    detailedDescriptionFormat: connector.detailedDescriptionFormat,
                    version: connector.version,
                    runtime: {
                        engine: connector.runtime.engine,
                        envVarsMetadata: connector.runtime.envVarsMetadata,
                    },
                    tools: connector.tools,
                    permissions: connector.permissions,
                    developer: connector.developer,
                    privacy: connector.privacy,
                },
                authContract,
                authExecution,
                portalAuthUrl: buildAuthUrl(getPortalOrigin(), String(connector._id), session.sessionId, session.state),
                providerAuthUrl: session.authUrl,
                redirectUri: session.redirectUri,
                capabilities: connector.capabilities || {
                    requiresAuth: authContract.category !== 'none',
                    supportsBackgroundSync: false,
                    supportsRealtime: false,
                    authUsage: {
                        type: authContract.category.startsWith('oauth2') ? 'session-based' : 'per-request',
                        injection: authContract.category === 'none' ? null : 'header',
                    },
                },
                uiHints: {
                    type: authContract.ui?.type || authContract.execution,
                    instructions: authContract.ui?.instructions || null,
                },
                user: {
                    id: String(session.userId),
                    name: sessionOwner.name,
                    email: sessionOwner.email,
                    status: sessionOwner.status,
                    role: sessionOwner.role,
                    planId: sessionOwner.plan_id || null,
                    subscriptionStatus: sessionOwner.subscription_status,
                    onboardingPhase: sessionOwner.onboardingPhase,
                    initiatedByAdmin: !!adminId,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/session/:sessionId
 * Poll the current auth session status
 */
export const getConnectorAuthSessionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.userId;
        const adminId = req.admin?.adminId;

        if (!sessionId) {
            throw new AppError('sessionId is required', 400, 'VALIDATION_ERROR');
        }

        const session = await ConnectorAuthSession.findOne({ sessionId });

        if (!session) {
            throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
        }

        if (!adminId && session.userId.toString() !== userId) {
            throw new AppError('Unauthorized: Session belongs to another user', 403, 'UNAUTHORIZED_ACCESS');
        }

        if (new Date() > session.expiresAt && session.status !== 'authenticated') {
            if (session.status !== 'expired') {
                session.status = 'expired';
                await session.save();
            }
        }

        const connector = await McpConnector.findById(session.connectorId).select('auth');
        const authContract = connector ? getNormalizedAuthContract(connector) : null;
        const expiryBufferSeconds = authContract?.tokenLifecycle?.expiryBufferSeconds ?? 300;
        const isTokenExpiringSoon = Boolean(
            session.tokenExpiresAt &&
            session.tokenExpiresAt.getTime() - Date.now() <= expiryBufferSeconds * 1000
        );

        res.status(200).json({
            status: 'success',
            data: {
                sessionId: session.sessionId,
                status: session.status,
                expiresAt: session.expiresAt,
                connectorId: session.connectorId,
                connectorName: session.connectorName,
                connectorTitle: session.connectorTitle,
                authMethod: session.authMethod,
                provider: session.provider,
                redirectUri: session.redirectUri,
                deviceId: session.deviceId,
                platform: session.platform,
                lastError: session.lastError || null,
                isExpired: new Date() > session.expiresAt,
                isTokenExpiringSoon,
                tokenExpiresAt: session.tokenExpiresAt || null,
                tokenLifecycle: authContract?.tokenLifecycle || {
                    autoRefresh: session.authMethod === 'oauth2',
                    expiryBufferSeconds,
                },
                isComplete:
                    session.status === 'authenticated' ||
                    session.status === 'failed' ||
                    session.status === 'expired',
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/handle/:provider
 * Direct callback handler from OAuth provider
 */
export const handleConnectorAuthCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const params = { ...req.query, ...req.body, ...req.params };

        console.log('--- RAW OAUTH CALLBACK DATA START ---');
        console.log(JSON.stringify(params, null, 2));
        console.log('--- RAW OAUTH CALLBACK DATA END ---');

        let {
            sessionId,
            state,
            code,
            error,
            errorDescription,
            error_description,
            provider: routeProvider,
            ...providerPayload
        } = params;

        const normalizedErrorDescription = errorDescription || error_description;

        if (!sessionId && state) {
            const stateMappedSession = await ConnectorAuthSession.findOne({ state });
            if (stateMappedSession) {
                sessionId = stateMappedSession.sessionId;
                console.log(`✅ Found sessionId ${sessionId} from state: ${state}`);
            } else {
                console.log(`❌ No session found for state: ${state}`);
            }
        }

        if (!sessionId || !state) {
            throw new AppError('sessionId and state are required', 400, 'VALIDATION_ERROR');
        }

        const session = await ConnectorAuthSession.findOne({ sessionId }).select('+codeVerifier +codeChallenge +codeChallengeMethod');

        if (!session) {
            throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
        }

        console.log('📋 Session retrieved:', {
            sessionId: session.sessionId,
            state: session.state,
            hasCodeVerifier: !!session.codeVerifier,
            codeVerifierLength: session.codeVerifier?.length,
            status: session.status
        });

        if (session.state !== state) {
            throw new AppError('Invalid state parameter. Security challenge failed.', 403, 'INVALID_STATE');
        }

        if (new Date() > session.expiresAt) {
            session.status = 'expired';
            await session.save();
            throw new AppError('Session has expired', 410, 'SESSION_EXPIRED');
        }

        const connector = await McpConnector.findById(session.connectorId);
        if (!connector || connector.isArchived) {
            throw new AppError('Connector is no longer available', 404, 'CONNECTOR_UNAVAILABLE');
        }

        const authContract = getNormalizedAuthContract(connector);

        if (!authContract.category.startsWith('oauth2')) {
            throw new AppError('Callback is only valid for OAuth connectors', 400, 'INVALID_AUTH_FLOW');
        }

        const oauthProvider = getResolvedOAuthProvider(connector, authContract);
        if (!oauthProvider) {
            throw new AppError('OAuth provider is not configured for this connector', 500, 'CONFIGURATION_ERROR');
        }

        if (error) {
            session.status = 'failed';
            session.lastError = {
                code: String(error),
                message: normalizedErrorDescription ? String(normalizedErrorDescription) : 'OAuth provider returned an error',
            };
            await session.save();

            if (req.method === 'GET') {
                res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Authentication Failed</title>
              <style>
                body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; }
                .card { background: #1e293b; padding: 2rem; border-radius: 12px; max-width: 400px; text-align: center; }
                h1 { color: #ef4444; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Authentication Failed</h1>
                <p>${session.lastError.message}</p>
                <p>Please close this window and try again.</p>
              </div>
            </body>
          </html>
        `);
                return;
            }

            res.status(200).json({
                status: 'success',
                data: {
                    sessionId: session.sessionId,
                    status: session.status,
                    lastError: session.lastError,
                },
            });
            return;
        }

        if (!code) {
            throw new AppError('OAuth code is required', 400, 'VALIDATION_ERROR');
        }

        const requiresPKCE = authContract.oauth?.pkceRequired === true;
        const hasCodeVerifier = !!session.codeVerifier;

        console.log('🔐 PKCE Check:', {
            requiresPKCE,
            hasCodeVerifier,
            codeVerifierValue: session.codeVerifier?.substring(0, 10) + '...'
        });

        if (requiresPKCE && !hasCodeVerifier) {
            console.error('❌ PKCE VERIFIER MISSING - Session data:', {
                sessionId: session.sessionId,
                codeVerifier: session.codeVerifier,
                codeChallenge: session.codeChallenge,
                authMethod: session.authMethod
            });
            throw new AppError('Missing PKCE verifier for this session. Start a new auth session and retry.', 400, 'PKCE_VERIFIER_MISSING');
        }

        session.status = 'pending';
        await session.save();

        console.log(`🔄 Exchanging OAuth code for ${oauthProvider}`);
        console.log(`Redirect URI: ${session.redirectUri}`);
        console.log(`Using code verifier: ${hasCodeVerifier ? 'YES' : 'NO'}`);

        const tokenResponse = await exchangeOAuthCodeByProvider(
            oauthProvider,
            code,
            session.redirectUri,
            session.codeVerifier || undefined
        );

        console.log('✅ Token exchange successful');

        session.authMethod = 'oauth2';
        session.provider = oauthProvider;
        session.encryptedAccessToken = encryptSecret(tokenResponse.access_token);
        session.encryptedRefreshToken = tokenResponse.refresh_token ? encryptSecret(tokenResponse.refresh_token) : undefined;
        session.idToken = tokenResponse.id_token || undefined;
        session.tokenType = tokenResponse.token_type || undefined;
        session.scope = tokenResponse.scope || undefined;
        session.tokenExpiresAt = tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined;
        session.providerAccountId = providerPayload?.team || providerPayload?.account_id || undefined;
        session.status = 'authenticated';
        session.lastError = undefined;
        await session.save();

        console.log('✅ Session marked as authenticated');

        const renderSuccessHtml = (data: any) => `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; }
            .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; }
            h1 { color: #10b981; margin-bottom: 1rem; }
            p { color: #94a3b8; line-height: 1.5; }
            .checkmark { font-size: 48px; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="checkmark">✅</div>
            <h1>Successfully Connected!</h1>
            <p>Your ${data.provider} account has been connected to SovereignAI.</p>
            <p>You can close this window and return to the application.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'AUTH_SUCCESS', sessionId: '${data.sessionId}' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </div>
        </body>
      </html>
    `;

        if (req.method === 'GET') {
            res.status(200).send(renderSuccessHtml({
                provider: session.provider || 'Google Workspace',
                sessionId: session.sessionId
            }));
            return;
        }

        res.status(200).json({
            status: 'success',
            message: 'Connector auth callback processed',
            data: {
                sessionId: session.sessionId,
                status: session.status,
                connectorId: session.connectorId,
                provider: session.provider,
                authMethod: session.authMethod,
                redirectUri: session.redirectUri,
            },
        });
    } catch (error) {
        console.error('❌ Callback error:', error);
        next(error);
    }
};

/**
 * GET /api/auth/session/:sessionId/credentials
 * Retrieve encrypted connector credentials for authenticated session
 */
export const getConnectorAuthSessionCredentials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.userId;
        const adminId = req.admin?.adminId;

        if (!sessionId) {
            throw new AppError('sessionId is required', 400, 'VALIDATION_ERROR');
        }

        const session = await ConnectorAuthSession.findOne({ sessionId })
            .select('+encryptedAccessToken +encryptedRefreshToken +idToken +tokenType +scope');

        if (!session) {
            throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
        }

        if (!adminId && session.userId.toString() !== userId) {
            throw new AppError('Unauthorized: Session belongs to another user', 403, 'UNAUTHORIZED_ACCESS');
        }

        if (session.status !== 'authenticated') {
            throw new AppError('Session is not authenticated yet', 409, 'SESSION_NOT_AUTHENTICATED');
        }

        if (!session.encryptedAccessToken) {
            throw new AppError('Encrypted credentials are not available for this session', 404, 'CREDENTIALS_NOT_FOUND');
        }

        res.status(200).json({
            status: 'success',
            data: {
                sessionId: session.sessionId,
                status: session.status,
                connectorId: session.connectorId,
                connectorName: session.connectorName,
                provider: session.provider,
                authMethod: session.authMethod,
                credentials: {
                    accessToken: session.encryptedAccessToken,
                    refreshToken: session.encryptedRefreshToken || null,
                    idToken: session.idToken || null,
                    tokenType: session.tokenType || null,
                    scope: session.scope || null,
                    tokenExpiresAt: session.tokenExpiresAt || null,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};