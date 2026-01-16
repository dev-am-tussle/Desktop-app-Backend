import { Request, Response, NextFunction } from 'express';
import { ChatCompletionService } from '../services/chatCompletion.service';
import { CompareService } from '../services/compare.service';
import { AppError } from '../middleware/errorHandler';

// ============================================
// CHAT CONTROLLERS
// ============================================

/**
 * Send chat completion request
 * POST /api/chat/completions
 */


/**
 * Handle Compare Mode request (multi-model comparison)
 * POST /api/chat/compare
 */
export const handleCompareRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { requestId, messages, contextStrategy, models } = req.body;

        // 🔍 DEBUG: Print complete received payload
        console.log('\n========================================');
        console.log('📦 RECEIVED PAYLOAD at /api/chat/compare:');
        console.log('========================================');
        console.log(JSON.stringify(req.body, null, 2));
        console.log('========================================\n');

        // Set Headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const service = new CompareService();

        // Execute comparison
        const emitter = await service.executeCompare({
            requestId,
            messages,
            contextStrategy,
            models
        });

        // Handle progressive model responses
        emitter.on('model_response', (data) => {
            res.write(`event: model_response\ndata: ${JSON.stringify(data)}\n\n`);
        });

        emitter.on('model_error', (data) => {
            res.write(`event: model_error\ndata: ${JSON.stringify(data)}\n\n`);
        });

        emitter.on('compare_complete', (data) => {
            res.write(`event: compare_complete\ndata: ${JSON.stringify(data)}\n\n`);
            res.end();
        });

        // Handle client disconnect
        req.on('close', () => {
            res.end();
        });

    } catch (error) {
        // If headers not sent, forward to error handler
        if (!res.headersSent) {
            next(error);
        } else {
            // If stream started, send error event
            res.write(`event: error\ndata: ${JSON.stringify({ message: 'Internal Server Error' })}\n\n`);
            res.end();
        }
    }
};

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
