import { Router } from 'express';
import { body } from 'express-validator';
import { sendChatCompletion } from '../controllers/chat.controller';
import { getSupportedProviders } from '../config/providers.config';

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

export default router;
