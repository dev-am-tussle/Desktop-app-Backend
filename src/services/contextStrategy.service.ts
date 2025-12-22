import { ChatMessage, ContextStrategy } from '../types/providerTypes';

// ============================================
// CONTEXT STRATEGY SERVICE
// ============================================

/**
 * Service to apply context policies to chat messages
 */
export class ContextStrategyService {
    /**
     * Apply context strategy to messages
     * @param messages - Original messages array
     * @param strategy - Context strategy to apply
     * @param options - Additional options (e.g., recentCount)
     * @returns Filtered messages based on strategy
     */
    static applyStrategy(
        messages: ChatMessage[],
        strategy: ContextStrategy = 'minimal',
        options?: { recentCount?: number }
    ): ChatMessage[] {
        switch (strategy) {
            case 'minimal':
                return this.applyMinimal(messages);

            case 'recent':
                return this.applyRecent(messages, options?.recentCount || 10);

            case 'full':
                return this.applyFull(messages);

            default:
                return this.applyMinimal(messages);
        }
    }

    /**
     * Minimal strategy: Return only the last user message
     * Useful for simple, stateless queries
     */
    private static applyMinimal(messages: ChatMessage[]): ChatMessage[] {
        // Keep system message if exists
        const systemMessage = messages.find((m) => m.role === 'system');

        // Get last user message
        const lastUserMessage = [...messages]
            .reverse()
            .find((m) => m.role === 'user');

        if (!lastUserMessage) {
            return messages; // Return all if no user message found
        }

        return systemMessage
            ? [systemMessage, lastUserMessage]
            : [lastUserMessage];
    }

    /**
     * Recent strategy: Return last N messages
     * Useful for maintaining short-term context
     */
    private static applyRecent(messages: ChatMessage[], count: number): ChatMessage[] {
        // Keep system message if exists
        const systemMessage = messages.find((m) => m.role === 'system');
        const conversationMessages = messages.filter((m) => m.role !== 'system');

        // Get last N messages
        const recentMessages = conversationMessages.slice(-count);

        return systemMessage
            ? [systemMessage, ...recentMessages]
            : recentMessages;
    }

    /**
     * Full strategy: Return all messages
     * Useful for maintaining complete conversation context
     */
    private static applyFull(messages: ChatMessage[]): ChatMessage[] {
        return messages;
    }

    /**
     * Get estimated token count for messages
     * Rough estimation: ~4 characters per token
     */
    static estimateTokenCount(messages: ChatMessage[]): number {
        const totalChars = messages.reduce(
            (sum, msg) => sum + msg.content.length,
            0
        );
        return Math.ceil(totalChars / 4);
    }

    /**
     * Validate messages array
     */
    static validateMessages(messages: ChatMessage[]): boolean {
        if (!Array.isArray(messages) || messages.length === 0) {
            return false;
        }

        // Check if all messages have required fields
        return messages.every(
            (msg) =>
                msg.role &&
                msg.content &&
                ['system', 'user', 'assistant'].includes(msg.role)
        );
    }
}
