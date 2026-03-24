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
            // Use the new /models endpoint to validate API key
            // This is cleaner than making a dummy chat request
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': this.apiVersion,
                },
            });

            const modelsCount = response.data?.data?.length || 0;

            return {
                valid: true,
                provider: 'anthropic',
                message: 'API key is valid',
                details: {
                    models: modelsCount,
                },
            };
        } catch (error: any) {
            if (error.response?.status === 401) {
                return {
                    valid: false,
                    provider: 'anthropic',
                    message: 'The Anthropic API key provided is invalid or has expired.',
                };
            }
            
            if (error.response?.status === 403) {
                return {
                    valid: false,
                    provider: 'anthropic',
                    message: 'Access denied. Your Anthropic API key does not have permission to use this model or service.',
                };
            }

            if (error.response?.status === 429) {
                return {
                    valid: false,
                    provider: 'anthropic',
                    message: 'Rate limit exceeded for Anthropic. Please check your account billing/tier or wait a moment.',
                };
            }

            return {
                valid: false,
                provider: 'anthropic',
                message: error.response?.data?.error?.message || error.message || 'An error occurred while validating the Anthropic API key.',
            };
        }
    }

    /**
     * Fetch available Anthropic models dynamically from the API
     */
    async fetchModels(): Promise<ModelFetchResponse> {
        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': this.apiVersion,
                },
            });

            const models: ModelInfo[] = response.data.data.map((model: any) => ({
                id: model.id,
                name: model.display_name || model.id,
                contextWindow: 200000, // Default for most Claude 3 models
            }));

            return {
                provider: 'anthropic',
                models,
                count: models.length,
            };
        } catch (error: any) {
            // Fallback to hardcoded models if dynamic fetch fails (legacy support)
            const fallbackModels = this.getAvailableModels().map(m => ({
                id: m.id,
                name: m.name,
                contextWindow: (m as any).context_window || 200000
            }));
            
            return {
                provider: 'anthropic',
                models: fallbackModels,
                count: fallbackModels.length,
            };
        }
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
     * Stream chat completion (not implemented for Compare Mode)
     * Compare Mode uses sendChatCompletion instead
     */
    async *streamChatCompletion(
        _model: string,
        _messages: ChatMessage[],
        _options?: {
            temperature?: number;
            maxTokens?: number;
        }
    ): AsyncGenerator<any, void, unknown> {
        throw new Error('Streaming not implemented for Anthropic adapter in Compare Mode');
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
    private getAvailableModels(): any[] {
        return [
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet',
                description: 'Most intelligent model, best for complex tasks',
                context_window: 200000,
                pricing: {
                    input: 3.0,
                    output: 15.0,
                },
            },
            {
                id: 'claude-3-5-haiku-20241022',
                name: 'Claude 3.5 Haiku',
                description: 'Fastest model, best for quick responses',
                context_window: 200000,
                pricing: {
                    input: 0.8,
                    output: 4.0,
                },
            },
            {
                id: 'claude-3-opus-20240229',
                name: 'Claude 3 Opus',
                description: 'Previous generation flagship model',
                context_window: 200000,
                pricing: {
                    input: 15.0,
                    output: 75.0,
                },
            },
            {
                id: 'claude-3-sonnet-20240229',
                name: 'Claude 3 Sonnet',
                description: 'Balanced performance and speed',
                context_window: 200000,
                pricing: {
                    input: 3.0,
                    output: 15.0,
                },
            },
            {
                id: 'claude-3-haiku-20240307',
                name: 'Claude 3 Haiku',
                description: 'Fast and cost-effective',
                context_window: 200000,
                pricing: {
                    input: 0.25,
                    output: 1.25,
                },
            },
        ];
    }
}
