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
                    message: 'The Grok (xAI) API key provided is invalid or has expired.',
                };
            }
            
            if (error.response?.status === 403) {
                return {
                    valid: false,
                    provider: 'grok',
                    message: 'Access denied. Your Grok API key does not have permission to use this service.',
                };
            }

            if (error.response?.status === 429) {
                return {
                    valid: false,
                    provider: 'grok',
                    message: 'Rate limit exceeded for Grok (xAI). Please check your account billing/tier or wait a moment.',
                };
            }

            return {
                valid: false,
                provider: 'grok',
                message: error.response?.data?.error?.message || error.message || 'An error occurred while validating the Grok API key.',
            };
        }
    }

    /**
     * Fetch available Grok models using the language-models endpoint
     */
    async fetchModels(): Promise<ModelFetchResponse> {
        try {
            const response = await axios.get(`${this.baseURL}/language-models`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });

            // According to the docs, models might be in response.data.models
            const modelsData = response.data.models || response.data.data || [];

            const models: ModelInfo[] = modelsData.map((model: any) => ({
                id: model.id,
                name: model.id,
                contextWindow: model.context_window || this.getContextWindow(model.id),
            }));

            return {
                provider: 'grok',
                models,
                count: models.length,
            };
        } catch (error: any) {
            // Fallback to /models if /language-models fails or to hardcoded
            try {
                const altResponse = await axios.get(`${this.baseURL}/models`, {
                    headers: { Authorization: `Bearer ${this.apiKey}` },
                });
                const altModels = altResponse.data.data.map((m: any) => ({
                    id: m.id,
                    name: m.id,
                    contextWindow: this.getContextWindow(m.id)
                }));
                return { provider: 'grok', models: altModels, count: altModels.length };
            } catch (e) {
                // Return standard fallback models
                const fallbackModels = [
                    { id: 'grok-2-1212', name: 'Grok 2', contextWindow: 131072 },
                    { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', contextWindow: 131072 },
                    { id: 'grok-beta', name: 'Grok Beta', contextWindow: 131072 }
                ];

                return {
                    provider: 'grok',
                    models: fallbackModels,
                    count: fallbackModels.length,
                };
            }
        }
    }

    /**
     * Send chat completion request to Grok using the Responses API
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
            // Using the new /responses endpoint as per docs
            const response = await axios.post(
                `${this.baseURL}/responses`,
                {
                    model,
                    input: messages, // The docs show "input" instead of "messages"
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
        // Grok Responses API returns "output_text" or uses OpenAI format
        const content = response.output_text || response.choices?.[0]?.message?.content || '';
        const model = response.model || '';
        const role = response.choices?.[0]?.message?.role || 'assistant';

        return {
            provider: 'grok',
            model: model,
            message: {
                role: role,
                content: content,
            },
            usage: {
                promptTokens: response.usage?.input_tokens || response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.output_tokens || response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            },
            finishReason: response.choices?.[0]?.finish_reason || response.stop_reason,
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
