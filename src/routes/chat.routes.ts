import { Router } from 'express';
import { body } from 'express-validator';
import { sendChatCompletion, handleCompareRequest } from '../controllers/chat.controller';
import { getSupportedProviders } from '../config/providers.config';
import { authenticateToken } from '../middleware/auth';
import { requireCapability } from '../middleware/entitlements';

// ============================================
// CHAT ROUTES
// ============================================

const router = Router();
const supportedProviders = getSupportedProviders();

/**
 * POST /api/chat/completions
 * Send chat completion request
 */
router.post(
    '/completions',
    authenticateToken,
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
        body('model')
            .notEmpty()
            .withMessage('Model is required')
            .isString()
            .withMessage('Model must be a string'),
        body('messages')
            .notEmpty()
            .withMessage('Messages are required')
            .isArray({ min: 1 })
            .withMessage('Messages must be a non-empty array'),
        body('messages.*.role')
            .notEmpty()
            .withMessage('Message role is required')
            .isIn(['system', 'user', 'assistant'])
            .withMessage('Message role must be one of: system, user, assistant'),
        body('messages.*.content')
            .notEmpty()
            .withMessage('Message content is required')
            .isString()
            .withMessage('Message content must be a string'),
        body('contextStrategy')
            .optional()
            .isIn(['minimal', 'recent', 'full'])
            .withMessage('Context strategy must be one of: minimal, recent, full'),
        body('temperature')
            .optional()
            .isFloat({ min: 0, max: 2 })
            .withMessage('Temperature must be between 0 and 2'),
        body('maxTokens')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Max tokens must be a positive integer'),
    ],
    sendChatCompletion
);

/**
 * POST /api/chat/compare
 * Handle Compare Mode request (multi-model comparison)
 * Requires compare_mode capability
 */
router.post(
    '/compare',
    authenticateToken,
    requireCapability('features.compare_mode'),
    [
        body('requestId')
            .notEmpty()
            .withMessage('Request ID is required')
            .isString(),
        body('mode')
            .equals('compare')
            .withMessage('Mode must be "compare"'),
        body('stream')
            .optional()
            .isBoolean()
            .withMessage('Stream must be a boolean'),
        body('messages')
            .notEmpty()
            .withMessage('Messages are required')
            .isArray({ min: 1 })
            .withMessage('Messages must be a non-empty array'),
        body('messages.*.role')
            .notEmpty()
            .withMessage('Message role is required')
            .isIn(['system', 'user', 'assistant'])
            .withMessage('Message role must be one of: system, user, assistant'),
        body('messages.*.content')
            .notEmpty()
            .withMessage('Message content is required')
            .isString()
            .withMessage('Message content must be a string'),
        body('contextStrategy')
            .optional()
            .isIn(['minimal', 'recent', 'full'])
            .withMessage('Context strategy must be one of: minimal, recent, full'),
        body('models')
            .isArray({ min: 2 })
            .withMessage('At least 2 models are required for comparison'),
        body('models.*.model')
            .notEmpty()
            .withMessage('Model ID is required'),
        body('models.*.provider')
            .notEmpty()
            .withMessage('Model provider is required')
            .isIn(supportedProviders)
            .withMessage(`Provider must be one of: ${supportedProviders.join(', ')}`),
        body('models.*.apiKey')
            .notEmpty()
            .withMessage('API key is required for each model')
            .isString()
            .withMessage('API key must be a string'),
    ],
    handleCompareRequest
);

export default router;
