// ============================================
// PROVIDER TYPES & INTERFACES
// ============================================

/**
 * Supported AI Providers
 */
export type ProviderName = 'openai' | 'anthropic' | 'google' | 'perplexity';

/**
 * Context strategies for chat completions
 */
export type ContextStrategy = 'minimal' | 'recent' | 'full';

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Chat message structure
 */
export interface ChatMessage {
    role: MessageRole;
    content: string;
}

/**
 * Provider validation request
 */
export interface ProviderValidationRequest {
    provider: ProviderName;
    apiKey: string;
}

/**
 * Provider validation response
 */
export interface ProviderValidationResponse {
    valid: boolean;
    provider: ProviderName;
    message: string;
    details?: {
        organization?: string;
        models?: number;
        [key: string]: any;
    };
}

/**
 * Model fetching request
 */
export interface ModelFetchRequest {
    provider: ProviderName;
    apiKey: string;
}

/**
 * Model information
 */
export interface ModelInfo {
    id: string;
    name: string;
    description?: string;
    contextWindow?: number;
    pricing?: {
        input?: number;
        output?: number;
    };
}

/**
 * Model fetching response
 */
export interface ModelFetchResponse {
    provider: ProviderName;
    models: ModelInfo[];
    count: number;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
    provider: ProviderName;
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    contextStrategy?: ContextStrategy;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
    provider: ProviderName;
    model: string;
    message: ChatMessage;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
}

/**
 * Provider adapter error
 */
export interface ProviderError {
    provider: ProviderName;
    code: string;
    message: string;
    statusCode?: number;
    details?: any;
}
