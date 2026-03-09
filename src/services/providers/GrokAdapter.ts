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
// GROK (xAI) PROVIDER ADAPTER (OpenAI Compatible)
// ============================================

export class GrokAdapter extends BaseProviderAdapter {
    private baseURL = getProviderBaseUrl('grok');

    constructor(apiKey: string) {
        super(apiKey, 'grok');
    }

    /**
     * Validate xAI API key by fetching models
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
                provider: 'grok',
                message: 'API key is valid',
                details: {
                    models: modelCount,
                },
            };
        } catch (error: any) {
            if (error.response?.status === 401) {
                return {
                    valid: false,
                    provider: 'grok',
                    message: 'Invalid API key',
                };
            }
            this.handleError(error);
        }
    }

    /**
     * Fetch available Grok models
     */
    async fetchModels(): Promise<ModelFetchResponse> {
        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });

            const models: ModelInfo[] = response.data.data.map((model: any) => ({
                id: model.id,
                name: model.id,
                description: `xAI ${model.id}`,
                contextWindow: this.getContextWindow(model.id),
            }));

            return {
                provider: 'grok',
                models,
                count: models.length,
            };
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Send chat completion request to Grok
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
     * Stream chat completion from Grok
     */
    async * streamChatCompletion(
        model: string,
        messages: ChatMessage[],
        options?: {
            temperature?: number;
            maxTokens?: number;
        }
    ): AsyncGenerator<any, void, unknown> {
        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model,
                    messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens,
                    stream: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    responseType: 'stream',
                }
            );

            const stream = response.data;

            for await (const chunk of stream) {
                const chunkStr = chunk.toString();
                const lines = chunkStr.split('\n');
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.includes('[DONE]')) return;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const delta = data.choices[0]?.delta?.content;
                            const finishReason = data.choices[0]?.finish_reason;
                            const usage = data.usage;

                            if (delta) yield { delta };
                            if (finishReason) yield { finishReason, usage };
                        } catch (e) {
                            // Ignored parse error on partial chunks
                        }
                    }
                }
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Normalize Grok response to standard format
     */
    protected normalizeResponse(response: any): ChatCompletionResponse {
        const choice = response.choices[0];

        return {
            provider: 'grok',
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
     * Get context window size for Grok models
     */
    private getContextWindow(modelId: string): number {
        const contextWindows: Record<string, number> = {
            'grok-4': 131072,
            'grok-2': 131072,
            'grok-2-mini': 131072,
            'grok-beta': 131072,
        };

        for (const [key, value] of Object.entries(contextWindows)) {
            if (modelId.toLowerCase().includes(key)) {
                return value;
            }
        }

        return 131072; // Default for xAI Grok
    }
}
