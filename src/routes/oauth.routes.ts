// src/routes/oauth.routes.ts
import { Router } from 'express';
import { OAuthController } from '../controllers/oauth.controller';

const router = Router();

// Initialize OAuth login
router.post('/init', OAuthController.initAuth);

// Callback handlers
router.get('/callback/google', OAuthController.googleCallback);
// router.get('/callback/microsoft', OAuthController.microsoftCallback); // Phase 2
router.get('/callback/microsoft', OAuthController.microsoftCallback);
// Get current session (for Electron polling)
router.get('/session', OAuthController.getSession);

// Logout (authentication will be added later)
router.post('/logout', OAuthController.logout);

export default router;