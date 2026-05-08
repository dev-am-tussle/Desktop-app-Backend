import axios from 'axios';
import OAuthAccount from '../models/OAuthAccount.model';
import User from '../models/User.model';
import { verifyToken } from '../utils/jwt';
import mongoose from 'mongoose';
import {
    createOAuthRegistrationResponse,
    provisionOAuthTrialUser,
} from './userProvisioning.service';

// Google OAuth config
const GOOGLE_CONFIG = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${process.env.BACKEND_URL}/oauth/callback/google`,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'email profile',
};

const MICROSOFT_CONFIG = {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    redirectUri: `${process.env.BACKEND_URL}/oauth/callback/microsoft`,
    authUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'openid email profile User.Read',
    // 'common' allows personal + work accounts; set a tenant GUID for single-tenant apps.
};

export class OAuthService {
    // Step 1: Generate auth URL
    static async getAuthUrl(provider: 'google' | 'microsoft'): Promise<string> {
        if (provider === 'google') {
            const state = this.generateState();
            const params = new URLSearchParams({
                client_id: GOOGLE_CONFIG.clientId,
                redirect_uri: GOOGLE_CONFIG.redirectUri,
                response_type: 'code',
                scope: GOOGLE_CONFIG.scope,
                access_type: 'offline',
                prompt: 'consent',
                state,
            });
            return `${GOOGLE_CONFIG.authUrl}?${params.toString()}`;
        }

        // ✅ Add Microsoft provider
        if (provider === 'microsoft') {
            const state = this.generateState();
            const params = new URLSearchParams({
                client_id: MICROSOFT_CONFIG.clientId,
                redirect_uri: MICROSOFT_CONFIG.redirectUri,
                response_type: 'code',
                scope: MICROSOFT_CONFIG.scope,
                response_mode: 'query',
                state,
            });
            return `${MICROSOFT_CONFIG.authUrl}?${params.toString()}`;
        }

        throw new Error(`Provider ${provider} not implemented yet`);
    }

    // Step 2: Handle callback and exchange code for tokens
    static async handleGoogleCallback(code: string): Promise<{ user: any; registrationResponse: any }> {
        // Exchange code for tokens
        const tokenParams = new URLSearchParams();
        tokenParams.append('code', code);
        tokenParams.append('client_id', GOOGLE_CONFIG.clientId);
        tokenParams.append('client_secret', GOOGLE_CONFIG.clientSecret);
        tokenParams.append('redirect_uri', GOOGLE_CONFIG.redirectUri);
        tokenParams.append('grant_type', 'authorization_code');

        const tokenResponse = await axios.post(GOOGLE_CONFIG.tokenUrl, tokenParams, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Get user info
        const userInfo = await axios.get(GOOGLE_CONFIG.userInfoUrl, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const { id: googleId, email, name } = userInfo.data;

        const randomPassword = Math.random().toString(36).slice(-16);
        const { user, subscriptionDetails } = await provisionOAuthTrialUser({
            name: name || email.split('@')[0],
            email,
            password: randomPassword,
            authProvider: {
                provider_name: 'google',
                verified: true,
            },
            consent: {
                termsAccepted: true,
                termsAcceptedAt: new Date(),
                termsVersion: 'v1',
            },
        });

        // Check if OAuth account already exists
        let oauthAccount = await OAuthAccount.findOne({
            provider: 'google',
            providerAccountId: googleId,
        });

        if (!oauthAccount) {
            // Create new OAuth account
            oauthAccount = await OAuthAccount.create({
                userId: user._id,
                provider: 'google',
                providerAccountId: googleId,
                email: email,
                accessToken: access_token,
                refreshToken: refresh_token,
                expiry: new Date(Date.now() + expires_in * 1000),
            });
        } else {
            // Update existing OAuth account
            oauthAccount.accessToken = access_token;
            if (refresh_token) oauthAccount.refreshToken = refresh_token;
            oauthAccount.expiry = new Date(Date.now() + expires_in * 1000);
            await oauthAccount.save();
        }

        return {
            user,
            registrationResponse: createOAuthRegistrationResponse(user, subscriptionDetails),
        };
    }

    // Step 2B : Handle callback and exchange code for tokens
    static async handleMicrosoftCallback(code: string): Promise<{ user: any; registrationResponse: any }> {
        // Exchange code for tokens
        const tokenParams = new URLSearchParams();
        tokenParams.append('code', code);
        tokenParams.append('client_id', MICROSOFT_CONFIG.clientId);
        tokenParams.append('client_secret', MICROSOFT_CONFIG.clientSecret);
        tokenParams.append('redirect_uri', MICROSOFT_CONFIG.redirectUri);
        tokenParams.append('grant_type', 'authorization_code');

        const tokenResponse = await axios.post(MICROSOFT_CONFIG.tokenUrl, tokenParams, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Get user info from Microsoft Graph API
        const userInfo = await axios.get(MICROSOFT_CONFIG.userInfoUrl, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        // Microsoft returns different field names
        const {
            id: microsoftId,
            mail: email,
            userPrincipalName,
            displayName: name,
            givenName,
            surname
        } = userInfo.data;

        // Use email from mail or userPrincipalName
        const userEmail = email || userPrincipalName;

        if (!userEmail) {
            throw new Error('Could not retrieve email from Microsoft account');
        }

        const randomPassword = Math.random().toString(36).slice(-16);
        const { user, subscriptionDetails } = await provisionOAuthTrialUser({
            name: name || `${givenName || ''} ${surname || ''}`.trim() || userEmail.split('@')[0],
            email: userEmail,
            password: randomPassword,
            authProvider: {
                provider_name: 'microsoft',
                verified: true,
            },
            consent: {
                termsAccepted: true,
                termsAcceptedAt: new Date(),
                termsVersion: 'v1',
            },
        });

        // Check if OAuth account already exists
        let oauthAccount = await OAuthAccount.findOne({
            provider: 'microsoft',
            providerAccountId: microsoftId,
        });

        if (!oauthAccount) {
            oauthAccount = await OAuthAccount.create({
                userId: user._id,
                provider: 'microsoft',
                providerAccountId: microsoftId,
                email: userEmail,
                accessToken: access_token,
                refreshToken: refresh_token,
                expiry: new Date(Date.now() + expires_in * 1000),
            });
        } else {
            oauthAccount.accessToken = access_token;
            if (refresh_token) oauthAccount.refreshToken = refresh_token;
            oauthAccount.expiry = new Date(Date.now() + expires_in * 1000);
            await oauthAccount.save();
        }

        return {
            user,
            registrationResponse: createOAuthRegistrationResponse(user, subscriptionDetails),
        };
    }

    // Refresh expired token
    static async refreshToken(userId: string): Promise<string> {
        const oauthAccount = await OAuthAccount.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            provider: 'google',
        });

        if (!oauthAccount || !oauthAccount.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await axios.post(GOOGLE_CONFIG.tokenUrl, {
            client_id: GOOGLE_CONFIG.clientId,
            client_secret: GOOGLE_CONFIG.clientSecret,
            refresh_token: oauthAccount.refreshToken,
            grant_type: 'refresh_token',
        });

        const { access_token, expires_in } = response.data;

        oauthAccount.accessToken = access_token;
        oauthAccount.expiry = new Date(Date.now() + expires_in * 1000);
        await oauthAccount.save();

        return access_token;
    }

    // Get session info for Electron
    static async getSession(sessionToken: string): Promise<any> {
        // Verify JWT
        const decoded = verifyToken(sessionToken);

        // Find user (MongoDB syntax)
        const user = await User.findById(decoded.userId);

        if (!user) throw new Error('User not found');

        return {
            userId: user._id,
            email: user.email,
            name: user.name,
            provider: 'google',
        };
    }

    private static generateState(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}