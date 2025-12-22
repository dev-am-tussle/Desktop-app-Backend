import {
    ProviderName,
    ProviderValidationResponse,
    ModelFetchResponse,
    ChatCompletionResponse,
    ChatMessage,
} from '../../types/providerTypes';

// ============================================
// BASE PROVIDER ADAPTER
// ============================================

/**
 * Abstract base class for all provider adapters
 * Each provider (OpenAI, Anthropic, Google) must implement this interface
 */
export abstract class BaseProviderAdapter {
    protected apiKey: string;
    protected providerName: ProviderName;

    constructor(apiKey: string, providerName: ProviderName) {
        this.apiKey = apiKey;
        this.providerName = providerName;
    }

    /**
     * Validate the API key by making a test request to the provider
     * @returns Validation response with provider details
     */
    abstract validateApiKey(): Promise<ProviderValidationResponse>;

    /**
     * Fetch available models from the provider
     * @returns List of available models
     */
    abstract fetchModels(): Promise<ModelFetchResponse>;

    /**
     * Send a chat completion request to the provider
     * @param model - Model ID to use
     * @param messages - Array of chat messages
     * @param options - Additional options (temperature, maxTokens, etc.)
     * @returns Chat completion response
     */
    abstract sendChatCompletion(
        model: string,
        messages: ChatMessage[],
        options?: {
            temperature?: number;
            maxTokens?: number;
            stream?: boolean;
        }
    ): Promise<ChatCompletionResponse>;

    /**
     * Normalize provider-specific response to standard format
     * @param response - Raw provider response
     * @returns Normalized chat completion response
     */
    protected abstract normalizeResponse(response: any): ChatCompletionResponse;

    /**
     * Handle provider-specific errors
     * @param error - Error from provider API
     * @throws Formatted error with provider context
     */
    protected handleError(error: any): never {
        const statusCode = error.response?.status || 500;
        const message = error.response?.data?.error?.message || error.message || 'Unknown error';

        throw {
            provider: this.providerName,
            code: error.response?.data?.error?.code || 'PROVIDER_ERROR',
            message,
            statusCode,
            details: error.response?.data,
        };
    }
}
