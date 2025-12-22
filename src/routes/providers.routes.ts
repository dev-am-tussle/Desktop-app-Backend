import { Router } from 'express';
import { body } from 'express-validator';
import { getSupportedProviders, validateProvider, fetchModels } from '../controllers/providers.controller';
import { getSupportedProviders as getSupportedProvidersList } from '../config/providers.config';

// ============================================
// PROVIDER ROUTES
// ============================================

const router = Router();
const supportedProviders = getSupportedProvidersList();

/**
 * GET /api/providers/supported
 * Get list of supported AI providers
 */
router.get('/supported', getSupportedProviders);

/**
 * POST /api/providers/validate
 * Validate API key for a provider
 */
router.post(
    '/validate',
    [
        body('provider')
            .notEmpty()
            .withMessage('Provider is required')
            .isIn(supportedProviders)
            .withMessage(`Provider must be one of: ${supportedProviders.join(', ')}`),
        body('apiKey')
            .notEmpty()
            .withMessage('API key is required')
            .isString()
            .withMessage('API key must be a string'),
    ],
    validateProvider
);

/**
 * POST /api/providers/models
 * Fetch available models for a provider
 */
router.post(
    '/models',
    [
        body('provider')
            .notEmpty()
            .withMessage('Provider is required')
            .isIn(supportedProviders)
            .withMessage(`Provider must be one of: ${supportedProviders.join(', ')}`),
        body('apiKey')
            .notEmpty()
            .withMessage('API key is required')
            .isString()
            .withMessage('API key must be a string'),
    ],
    fetchModels
);

export default router;
