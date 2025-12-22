import axios from 'axios';
import { BaseProviderAdapter } from './BaseProviderAdapter';
import {
    ProviderValidationResponse,
    ModelFetchResponse,
    ChatCompletionResponse,
    ChatMessage,
    ModelInfo,
} from '../../types/providerTypes';
import { getProviderBaseUrl } from '../../config/providers.config';

// ============================================
// ANTHROPIC PROVIDER ADAPTER
// ============================================

export class AnthropicAdapter extends BaseProviderAdapter {
    private baseURL = getProviderBaseUrl('anthropic');
    private apiVersion = '2023-06-01';

    constructor(apiKey: string) {
        super(apiKey, 'anthropic');
    }

    /**
     * Validate Anthropic API key by making a test request
     */
    async validateApiKey(): Promise<ProviderValidationResponse> {
        try {
            // Test with a minimal message request
            await axios.post(
                `${this.baseURL}/messages`,
                {
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Hi' }],
                },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'anthropic-version': this.apiVersion,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return {
                valid: true,
                provider: 'anthropic',
                message: 'API key is valid',
                details: {
                    models: this.getAvailableModels().length,
                },
            };
        } catch (error: any) {
            if (error.response?.status === 401) {
                return {
                    valid: false,
                    provider: 'anthropic',
                    message: 'Invalid API key',
                };
            }
            this.handleError(error);
        }
    }

    /**
     * Fetch available Anthropic models
     * Note: Anthropic doesn't have a models endpoint, so we return a predefined list
     */
    async fetchModels(): Promise<ModelFetchResponse> {
        const models = this.getAvailableModels();

        return {
            provider: 'anthropic',
            models,
            count: models.length,
        };
    }

    /**
     * Send chat completion request to Anthropic
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
            // Anthropic requires system messages to be separate
            const systemMessage = messages.find((m) => m.role === 'system');
            const conversationMessages = messages.filter((m) => m.role !== 'system');

            const requestBody: any = {
                model,
                max_tokens: options?.maxTokens || 4096,
                messages: conversationMessages,
                temperature: options?.temperature ?? 0.7,
                stream: options?.stream ?? false,
            };

            if (systemMessage) {
                requestBody.system = systemMessage.content;
            }

            const response = await axios.post(`${this.baseURL}/messages`, requestBody, {
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': this.apiVersion,
                    'Content-Type': 'application/json',
                },
            });

            return this.normalizeResponse(response.data);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Normalize Anthropic response to standard format
     */
    protected normalizeResponse(response: any): ChatCompletionResponse {
        const content = response.content[0].text;

        return {
            provider: 'anthropic',
            model: response.model,
            message: {
                role: 'assistant',
                content,
            },
            usage: {
                promptTokens: response.usage?.input_tokens || 0,
                completionTokens: response.usage?.output_tokens || 0,
                totalTokens:
                    (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            },
            finishReason: response.stop_reason,
        };
    }

    /**
     * Get list of available Anthropic models
     */
    private getAvailableModels(): ModelInfo[] {
        return [
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet',
                description: 'Most intelligent model, best for complex tasks',
                contextWindow: 200000,
                pricing: {
                    input: 3.0,
                    output: 15.0,
                },
            },
            {
                id: 'claude-3-5-haiku-20241022',
                name: 'Claude 3.5 Haiku',
                description: 'Fastest model, best for quick responses',
                contextWindow: 200000,
                pricing: {
                    input: 0.8,
                    output: 4.0,
                },
            },
            {
                id: 'claude-3-opus-20240229',
                name: 'Claude 3 Opus',
                description: 'Previous generation flagship model',
                contextWindow: 200000,
                pricing: {
                    input: 15.0,
                    output: 75.0,
                },
            },
            {
                id: 'claude-3-sonnet-20240229',
                name: 'Claude 3 Sonnet',
                description: 'Balanced performance and speed',
                contextWindow: 200000,
                pricing: {
                    input: 3.0,
                    output: 15.0,
                },
            },
            {
                id: 'claude-3-haiku-20240307',
                name: 'Claude 3 Haiku',
                description: 'Fast and cost-effective',
                contextWindow: 200000,
                pricing: {
                    input: 0.25,
                    output: 1.25,
                },
            },
        ];
    }
}
