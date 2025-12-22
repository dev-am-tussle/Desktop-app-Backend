import axios from 'axios';
import { BaseProviderAdapter } from './BaseProviderAdapter';
import {
    ProviderValidationResponse,
    ModelFetchResponse,
    ChatCompletionResponse,
    ChatMessage,
    ModelInfo,
} from '../../types/providerTypes';
import { getProviderBaseUrl, PROVIDER_CONFIG } from '../../config/providers.config';

// ============================================
// PERPLEXITY PROVIDER ADAPTER
// ============================================

export class PerplexityAdapter extends BaseProviderAdapter {
    private baseURL = getProviderBaseUrl('perplexity');

    // Hardcoded Perplexity Sonar models
    private static readonly PERPLEXITY_MODELS: ModelInfo[] = [
        {
            id: 'sonar',
            name: 'Sonar',
            description: 'Lightweight search model for quick queries',
            contextWindow: 127072,
        },
        {
            id: 'sonar-pro',
            name: 'Sonar Pro',
            description: 'Advanced search model with enhanced capabilities',
            contextWindow: 127072,
        },
        {
            id: 'sonar-deep-research',
            name: 'Sonar Deep Research',
            description: 'Exhaustive research model for comprehensive analysis',
            contextWindow: 127072,
        },
        {
            id: 'sonar-reasoning-pro',
            name: 'Sonar Reasoning Pro',
            description: 'Premier reasoning model for complex problem-solving',
            contextWindow: 127072,
        },
    ];

    constructor(apiKey: string) {
        super(apiKey, 'perplexity');
    }

    /**
     * Validate Perplexity API key by making a lightweight chat request
     * Note: Perplexity doesn't have a dedicated "whoami" endpoint,
     * so we validate by sending a minimal chat completion request
     */
    async validateApiKey(): Promise<ProviderValidationResponse> {
        try {
            // Make a minimal chat request to validate the API key
            await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: 'sonar',
                    messages: [
                        {
                            role: 'user',
                            content: 'Hi',
                        },
                    ],
                    max_tokens: PROVIDER_CONFIG.VALIDATION.PERPLEXITY_VALIDATION_TOKENS, // Minimal tokens to reduce cost
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // If request succeeds, API key is valid
            return {
                valid: true,
                provider: 'perplexity',
                message: 'API key is valid',
                details: {
                    models: PerplexityAdapter.PERPLEXITY_MODELS.length,
                    availableModels: PerplexityAdapter.PERPLEXITY_MODELS.map((m) => m.id),
                },
            };
        } catch (error: any) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                return {
                    valid: false,
                    provider: 'perplexity',
                    message: 'Invalid API key',
                };
            }
            this.handleError(error);
        }
    }

    /**
     * Fetch available Perplexity models
     * Note: Perplexity doesn't have a models endpoint,
     * so we return hardcoded Sonar models
     */
    async fetchModels(): Promise<ModelFetchResponse> {
        return {
            provider: 'perplexity',
            models: PerplexityAdapter.PERPLEXITY_MODELS,
            count: PerplexityAdapter.PERPLEXITY_MODELS.length,
        };
    }

    /**
     * Send chat completion request to Perplexity
     */
    async sendChatCompletion(
        model: string,
        messages: ChatMessage[],
        options?: {
            temperature?: number;
            maxTokens?: number;
            stream?: boolean;
        }
    ): Promise<ChatCompletionResponse> {
        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model,
                    messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens,
                    stream: options?.stream ?? false,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return this.normalizeResponse(response.data);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Normalize Perplexity response to standard format
     */
    protected normalizeResponse(response: any): ChatCompletionResponse {
        const choice = response.choices[0];

        return {
            provider: 'perplexity',
            model: response.model,
            message: {
                role: choice.message.role,
                content: choice.message.content,
            },
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            },
            finishReason: choice.finish_reason,
        };
    }
}
