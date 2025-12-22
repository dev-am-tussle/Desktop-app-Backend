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
// GOOGLE PROVIDER ADAPTER
// ============================================

export class GoogleAdapter extends BaseProviderAdapter {
    private baseURL = getProviderBaseUrl('google');

    constructor(apiKey: string) {
        super(apiKey, 'google');
    }

    /**
     * Validate Google API key by fetching models
     */
    async validateApiKey(): Promise<ProviderValidationResponse> {
        try {
            const response = await axios.get(`${this.baseURL}/models?key=${this.apiKey}`);

            const geminiModels = response.data.models?.filter((model: any) =>
                model.name.includes('gemini')
            );

            return {
                valid: true,
                provider: 'google',
                message: 'API key is valid',
                details: {
                    models: geminiModels?.length || 0,
                },
            };
        } catch (error: any) {
            if (error.response?.status === 400 || error.response?.status === 401) {
                return {
                    valid: false,
                    provider: 'google',
                    message: 'Invalid API key',
                };
            }
            this.handleError(error);
        }
    }

    /**
     * Fetch available Google Gemini models
     */
    async fetchModels(): Promise<ModelFetchResponse> {
        try {
            const response = await axios.get(`${this.baseURL}/models?key=${this.apiKey}`);

            const geminiModels = response.data.models?.filter(
                (model: any) =>
                    model.name.includes('gemini') &&
                    model.supportedGenerationMethods?.includes('generateContent')
            );

            const models: ModelInfo[] = geminiModels.map((model: any) => {
                const modelId = model.name.replace('models/', '');
                return {
                    id: modelId,
                    name: model.displayName || modelId,
                    description: model.description || `Google ${modelId}`,
                    contextWindow: this.getContextWindow(modelId),
                };
            });

            return {
                provider: 'google',
                models,
                count: models.length,
            };
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Send chat completion request to Google Gemini
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
            // Convert messages to Gemini format
            const geminiMessages = this.convertToGeminiFormat(messages);

            const requestBody = {
                contents: geminiMessages,
                generationConfig: {
                    temperature: options?.temperature ?? 0.7,
                    maxOutputTokens: options?.maxTokens,
                },
            };

            const modelPath = model.startsWith('models/') ? model : `models/${model}`;
            const response = await axios.post(
                `${this.baseURL}/${modelPath}:generateContent?key=${this.apiKey}`,
                requestBody,
                {
                    headers: {
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
     * Normalize Google response to standard format
     */
    protected normalizeResponse(response: any): ChatCompletionResponse {
        const candidate = response.candidates[0];
        const content = candidate.content.parts[0].text;

        return {
            provider: 'google',
            model: 'gemini',
            message: {
                role: 'assistant',
                content,
            },
            usage: {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0,
            },
            finishReason: candidate.finishReason,
        };
    }

    /**
     * Convert standard chat messages to Gemini format
     */
    private convertToGeminiFormat(messages: ChatMessage[]): any[] {
        return messages
            .filter((m) => m.role !== 'system') // Gemini doesn't support system messages directly
            .map((message) => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: message.content }],
            }));
    }

    /**
     * Get context window size for Gemini models
     */
    private getContextWindow(modelId: string): number {
        const contextWindows: Record<string, number> = {
            'gemini-2.0-flash-exp': 1000000,
            'gemini-1.5-pro': 2000000,
            'gemini-1.5-flash': 1000000,
            'gemini-1.0-pro': 32768,
        };

        // Find matching model
        for (const [key, value] of Object.entries(contextWindows)) {
            if (modelId.includes(key)) {
                return value;
            }
        }

        return 32768; // Default
    }
}
