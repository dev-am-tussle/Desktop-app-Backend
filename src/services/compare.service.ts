
import { EventEmitter } from 'events';
import { ChatCompletionService } from './chatCompletion.service';
import { ProviderName, ChatMessage } from '../types/providerTypes';

export interface CompareRequest {
    requestId: string;
    messages: ChatMessage[];
    contextStrategy?: 'minimal' | 'recent' | 'full';
    models: Array<{
        model: string;
        provider: ProviderName;
        apiKey: string;
    }>;
}

export class CompareService {
    /**
     * Execute comparison in parallel using existing chat completion logic
     * Returns an EventEmitter that emits progressive responses
     */
    async executeCompare(payload: CompareRequest): Promise<EventEmitter> {
        const { requestId, messages, contextStrategy, models } = payload;
        const emitter = new EventEmitter();
        let completedModels = 0;
        const totalModels = models.length;

        // Process each model in parallel
        models.forEach(async (modelConfig) => {
            const { model: modelId, provider, apiKey } = modelConfig;
            const startTime = Date.now();

            try {
                // Validation
                if (!apiKey) {
                    throw new Error(`API key missing for provider ${provider}`);
                }

                // Reuse existing chat completion service
                const result = await ChatCompletionService.sendCompletion({
                    provider,
                    apiKey,
                    model: modelId,
                    messages,
                    contextStrategy: contextStrategy || 'minimal',
                });

                const latency = Date.now() - startTime;

                // Emit model response immediately when ready
                emitter.emit('model_response', {
                    requestId,
                    modelId,
                    provider,
                    response: result,
                    latency
                });

            } catch (error: any) {
                emitter.emit('model_error', {
                    requestId,
                    modelId,
                    provider,
                    error: error.message || 'Unknown error'
                });
            } finally {
                completedModels++;

                // Emit completion event when all models are done
                if (completedModels === totalModels) {
                    emitter.emit('compare_complete', {
                        requestId,
                        totalModels,
                        completedModels
                    });
                }
            }
        });

        return emitter;
    }
}
