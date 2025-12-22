import { Request, Response, NextFunction } from 'express';
import { ChatCompletionService } from '../services/chatCompletion.service';
import { AppError } from '../middleware/errorHandler';

// ============================================
// CHAT CONTROLLERS
// ============================================

/**
 * Send chat completion request
 * POST /api/chat/completions
 */
export const sendChatCompletion = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            provider,
            apiKey,
            model,
            messages,
            contextStrategy,
            temperature,
            maxTokens,
        } = req.body;

        // Validate required fields
        if (!provider) {
            throw new AppError('Provider is required', 400, 'MISSING_PROVIDER');
        }

        if (!apiKey) {
            throw new AppError('API key is required', 400, 'MISSING_API_KEY');
        }

        if (!model) {
            throw new AppError('Model is required', 400, 'MISSING_MODEL');
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new AppError(
                'Messages array is required and must not be empty',
                400,
                'MISSING_MESSAGES'
            );
        }

        const result = await ChatCompletionService.sendCompletion({
            provider,
            apiKey,
            model,
            messages,
            contextStrategy: contextStrategy || 'minimal',
            temperature,
            maxTokens,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
