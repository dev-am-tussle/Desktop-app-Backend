import {
    ChatCompletionRequest,
    ChatCompletionResponse,
} from '../types/providerTypes';
import { ProviderFactory } from './providers/ProviderFactory';
import { ContextStrategyService } from './contextStrategy.service';
import { PROVIDER_CONFIG } from '../config/providers.config';

// ============================================
// CHAT COMPLETION SERVICE
// ============================================

/**
 * Service for handling chat completions
 */
export class ChatCompletionService {
    private static readonly MAX_RETRIES = PROVIDER_CONFIG.MAX_RETRIES;
    private static readonly RETRY_DELAY_MS = PROVIDER_CONFIG.RETRY_DELAY_MS;

    /**
     * Send chat completion request
     * @param request - Chat completion request
     * @returns Chat completion response
     */
    static async sendCompletion(
        request: ChatCompletionRequest
    ): Promise<ChatCompletionResponse> {
        const { provider, apiKey, model, messages, contextStrategy, temperature, maxTokens } =
            request;

        // Validate inputs
        this.validateRequest(request);

        // Apply context strategy
        const filteredMessages = ContextStrategyService.applyStrategy(
            messages,
            contextStrategy || 'minimal'
        );

        // Create adapter
        const adapter = ProviderFactory.createAdapter(provider, apiKey);

        // Send request with retry logic
        return await this.sendWithRetry(
            async () => {
                return await adapter.sendChatCompletion(model, filteredMessages, {
                    temperature,
                    maxTokens,
                });
            },
            this.MAX_RETRIES
        );
    }

    /**
     * Validate chat completion request
     */
    private static validateRequest(request: ChatCompletionRequest): void {
        const { provider, apiKey, model, messages } = request;

        // Check provider
        if (!ProviderFactory.isProviderSupported(provider)) {
            throw new Error(
                `Unsupported provider: ${provider}. Supported providers: ${ProviderFactory.getSupportedProviders().join(', ')}`
            );
        }

        // Check API key
        if (!apiKey || apiKey.trim().length === 0) {
            throw new Error('API key is required');
        }

        // Check model
        if (!model || model.trim().length === 0) {
            throw new Error('Model is required');
        }

        // Check messages
        if (!ContextStrategyService.validateMessages(messages)) {
            throw new Error(
                'Invalid messages format. Messages must be a non-empty array with role and content fields'
            );
        }
    }

    /**
     * Send request with retry logic
     */
    private static async sendWithRetry<T>(
        fn: () => Promise<T>,
        retriesLeft: number
    ): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            // Don't retry on authentication errors
            if (error.statusCode === 401 || error.statusCode === 403) {
                throw error;
            }

            // Don't retry on validation errors
            if (error.statusCode === 400) {
                throw error;
            }

            // Retry on server errors or network issues
            if (retriesLeft > 0) {
                await this.delay(this.RETRY_DELAY_MS);
                return this.sendWithRetry(fn, retriesLeft - 1);
            }

            throw error;
        }
    }

    /**
     * Delay helper for retries
     */
    private static delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
