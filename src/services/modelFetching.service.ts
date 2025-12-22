import { ModelFetchRequest, ModelFetchResponse } from '../types/providerTypes';
import { ProviderFactory } from './providers/ProviderFactory';

// ============================================
// MODEL FETCHING SERVICE
// ============================================

/**
 * Service for fetching available models from providers
 */
export class ModelFetchingService {
    /**
     * Fetch available models for a provider
     * @param request - Model fetch request with provider and API key
     * @returns Model fetch response with list of models
     */
    static async fetchModels(request: ModelFetchRequest): Promise<ModelFetchResponse> {
        const { provider, apiKey } = request;

        // Check if provider is supported
        if (!ProviderFactory.isProviderSupported(provider)) {
            throw new Error(
                `Unsupported provider: ${provider}. Supported providers: ${ProviderFactory.getSupportedProviders().join(', ')}`
            );
        }

        // Validate API key format
        if (!apiKey || apiKey.trim().length === 0) {
            throw new Error('API key is required');
        }

        try {
            // Create adapter and fetch models
            const adapter = ProviderFactory.createAdapter(provider, apiKey);
            const result = await adapter.fetchModels();

            return result;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch models');
        }
    }
}
