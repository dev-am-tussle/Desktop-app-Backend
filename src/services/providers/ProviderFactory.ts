import { ProviderName } from '../../types/providerTypes';
import { BaseProviderAdapter } from './BaseProviderAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { GoogleAdapter } from './GoogleAdapter';
import { PerplexityAdapter } from './PerplexityAdapter';
import { getSupportedProviders, isProviderSupported } from '../../config/providers.config';

// ============================================
// PROVIDER FACTORY
// ============================================

/**
 * Factory class to create provider adapters
 */
export class ProviderFactory {
    /**
     * Create a provider adapter instance based on provider name
     * @param provider - Provider name (openai, anthropic, google, perplexity)
     * @param apiKey - API key for the provider
     * @returns Provider adapter instance
     */
    static createAdapter(provider: ProviderName, apiKey: string): BaseProviderAdapter {
        switch (provider.toLowerCase()) {
            case 'openai':
                return new OpenAIAdapter(apiKey);

            case 'anthropic':
                return new AnthropicAdapter(apiKey);

            case 'google':
                return new GoogleAdapter(apiKey);

            case 'perplexity':
                return new PerplexityAdapter(apiKey);

            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Get list of supported providers
     */
    static getSupportedProviders(): ProviderName[] {
        return getSupportedProviders();
    }

    /**
     * Check if a provider is supported
     */
    static isProviderSupported(provider: string): boolean {
        return isProviderSupported(provider);
    }
}
