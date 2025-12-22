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
// OPENAI PROVIDER ADAPTER
// ============================================

export class OpenAIAdapter extends BaseProviderAdapter {
    private baseURL = getProviderBaseUrl('openai');

    constructor(apiKey: string) {
        super(apiKey, 'openai');
    }

    /**
     * Validate OpenAI API key by fetching models
     */
    async validateApiKey(): Promise<ProviderValidationResponse> {
        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });

            const modelCount = response.data.data?.length || 0;

            return {
                valid: true,
                provider: 'openai',
                message: 'API key is valid',
                details: {
                    models: modelCount,
                    organization: response.headers['openai-organization'] || 'default',
                },
            };
        } catch (error: any) {
            if (error.response?.status === 401) {
                return {
                    valid: false,
                    provider: 'openai',
                    message: 'Invalid API key',
                };
            }
            this.handleError(error);
        }
    }

    /**
     * Fetch available OpenAI models
     */
    async fetchModels(): Promise<ModelFetchResponse> {
        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });

            // Filter for GPT models only
            const gptModels = response.data.data.filter((model: any) =>
                model.id.includes('gpt') || model.id.includes('o1')
            );

            const models: ModelInfo[] = gptModels.map((model: any) => ({
                id: model.id,
                name: model.id,
                description: `OpenAI ${model.id}`,
                contextWindow: this.getContextWindow(model.id),
            }));

            return {
                provider: 'openai',
                models,
                count: models.length,
            };
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Send chat completion request to OpenAI
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
     * Normalize OpenAI response to standard format
     */
    protected normalizeResponse(response: any): ChatCompletionResponse {
        const choice = response.choices[0];

        return {
            provider: 'openai',
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

    /**
     * Get context window size for OpenAI models
     */
    private getContextWindow(modelId: string): number {
        const contextWindows: Record<string, number> = {
            'gpt-4o': 128000,
            'gpt-4o-mini': 128000,
            'gpt-4-turbo': 128000,
            'gpt-4': 8192,
            'gpt-3.5-turbo': 16385,
            'o1-preview': 128000,
            'o1-mini': 128000,
        };

        // Find matching model
        for (const [key, value] of Object.entries(contextWindows)) {
            if (modelId.includes(key)) {
                return value;
            }
        }

        return 8192; // Default
    }
}
