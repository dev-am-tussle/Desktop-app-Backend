import { ProviderName } from '../types/providerTypes';

// ============================================
// PROVIDER CONFIGURATION
// ============================================

/**
 * Centralized provider configuration
 * Single source of truth for all provider-related constants
 */

/**
 * List of all supported AI providers
 * Add new providers here to enable them across the entire application
 */
export const SUPPORTED_PROVIDERS: readonly ProviderName[] = [
    'openai',
    'anthropic',
    'google',
    'perplexity',
] as const;

/**
 * Provider display names for UI
 */
export const PROVIDER_DISPLAY_NAMES: Record<ProviderName, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google AI',
    perplexity: 'Perplexity AI',
};

/**
 * Provider API base URLs
 */
export const PROVIDER_BASE_URLS: Record<ProviderName, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta',
    perplexity: 'https://api.perplexity.ai',
};

/**
 * Provider-specific configuration
 */
export const PROVIDER_CONFIG = {
    /**
     * Default temperature for chat completions
     */
    DEFAULT_TEMPERATURE: 0.7,

    /**
     * Maximum retry attempts for failed requests
     */
    MAX_RETRIES: 3,

    /**
     * Retry delay in milliseconds
     */
    RETRY_DELAY_MS: 1000,

    /**
     * Validation request configuration
     */
    VALIDATION: {
        /**
         * Minimal tokens for Perplexity validation
         */
        PERPLEXITY_VALIDATION_TOKENS: 1,
    },
} as const;

/**
 * Helper function to check if a provider is supported
 */
export function isProviderSupported(provider: string): provider is ProviderName {
    return SUPPORTED_PROVIDERS.includes(provider as ProviderName);
}

/**
 * Helper function to get provider display name
 */
export function getProviderDisplayName(provider: ProviderName): string {
    return PROVIDER_DISPLAY_NAMES[provider];
}

/**
 * Helper function to get provider base URL
 */
export function getProviderBaseUrl(provider: ProviderName): string {
    return PROVIDER_BASE_URLS[provider];
}

/**
 * Helper function to get all supported providers
 */
export function getSupportedProviders(): ProviderName[] {
    return [...SUPPORTED_PROVIDERS];
}
