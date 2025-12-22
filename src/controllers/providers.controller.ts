import { Request, Response, NextFunction } from 'express';
import { ProviderValidationService } from '../services/providerValidation.service';
import { ModelFetchingService } from '../services/modelFetching.service';
import { ProviderFactory } from '../services/providers/ProviderFactory';
import { AppError } from '../middleware/errorHandler';

// ============================================
// PROVIDER CONTROLLERS
// ============================================

/**
 * Get list of supported providers
 * GET /api/providers/supported
 */
export const getSupportedProviders = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const providers = ProviderFactory.getSupportedProviders();

        res.json({
            success: true,
            data: {
                providers,
                count: providers.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Validate API key for a provider
 * POST /api/providers/validate
 */
export const validateProvider = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { provider, apiKey } = req.body;

        // Validate required fields
        if (!provider || !apiKey) {
            throw new AppError('Provider and API key are required', 400, 'MISSING_FIELDS');
        }

        const result = await ProviderValidationService.validateProvider({
            provider,
            apiKey,
        });

        res.json({
            success: result.valid,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Fetch available models for a provider
 * POST /api/providers/models
 */
export const fetchModels = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { provider, apiKey } = req.body;

        // Validate required fields
        if (!provider || !apiKey) {
            throw new AppError('Provider and API key are required', 400, 'MISSING_FIELDS');
        }

        const result = await ModelFetchingService.fetchModels({
            provider,
            apiKey,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
