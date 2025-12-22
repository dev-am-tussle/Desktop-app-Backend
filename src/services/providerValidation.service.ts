import { ProviderValidationRequest, ProviderValidationResponse } from '../types/providerTypes';
import { ProviderFactory } from './providers/ProviderFactory';

// ============================================
// PROVIDER VALIDATION SERVICE
// ============================================

/**
 * Service for validating API keys
 */
export class ProviderValidationService {
    /**
     * Validate API key for a provider
     * @param request - Validation request with provider and API key
     * @returns Validation response
     */
    static async validateProvider(
        request: ProviderValidationRequest
    ): Promise<ProviderValidationResponse> {
        const { provider, apiKey } = request;

        // Check if provider is supported
        if (!ProviderFactory.isProviderSupported(provider)) {
            return {
                valid: false,
                provider,
                message: `Unsupported provider: ${provider}. Supported providers: ${ProviderFactory.getSupportedProviders().join(', ')}`,
            };
        }

        // Validate API key format
        if (!apiKey || apiKey.trim().length === 0) {
            return {
                valid: false,
                provider,
                message: 'API key is required',
            };
        }

        try {
            // Create adapter and validate
            const adapter = ProviderFactory.createAdapter(provider, apiKey);
            const result = await adapter.validateApiKey();

            return result;
        } catch (error: any) {
            return {
                valid: false,
                provider,
                message: error.message || 'Validation failed',
                details: error.details,
            };
        }
    }
}
