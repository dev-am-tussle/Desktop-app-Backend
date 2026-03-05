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
// GROQ PROVIDER ADAPTER (OpenAI Compatible)
// ============================================

export class GroqAdapter extends BaseProviderAdapter {
    private baseURL = getProviderBaseUrl('groq');

    constructor(apiKey: string) {
        super(apiKey, 'groq');
    }

    /**
     * Validate Groq API key by fetching models
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
                provider: 'groq',
                message: 'API key is valid',
                details: {
                    models: modelCount,
                },
            };
        } catch (error: any) {
            if (error.response?.status === 401) {
                return {
                    valid: false,
                    provider: 'groq',
                    message: 'Invalid API key',
                };
            }
            this.handleError(error);
        }
    }

    /**
     * Fetch available Groq models
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
                description: `Groq ${model.id}`,
                contextWindow: this.getContextWindow(model.id),
            }));

            return {
                provider: 'groq',
                models,
                count: models.length,
            };
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Send chat completion request to Groq
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
     * Stream chat completion from Groq
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
                const lines = chunk.toString().split('\n');
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
     * Normalize Groq response to standard format
     */
    protected normalizeResponse(response: any): ChatCompletionResponse {
        const choice = response.choices[0];

        return {
            provider: 'groq',
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
     * Get context window size for Groq models
     */
    private getContextWindow(modelId: string): number {
        const contextWindows: Record<string, number> = {
            'llama3-8b': 8192,
            'llama3-70b': 8192,
            'mixtral-8x7b': 32768,
            'gemma-7b': 8192,
            'gemma2-9b': 8192,
            'llama-3.1': 128000,
            'llama-3.2': 128000,
        };

        for (const [key, value] of Object.entries(contextWindows)) {
            if (modelId.toLowerCase().includes(key)) {
                return value;
            }
        }

        return 8192; // Default
    }
}
