# External API Chat Service - Walkthrough

This document provides a comprehensive guide to the External API Chat Service implementation.

## Overview

The External API Chat Service provides three main endpoints for integrating with external AI providers (OpenAI, Anthropic, Google). All operations are **stateless** and do not store any data in the database.

## Architecture

### Layer Structure

```
Routes Layer (HTTP Interface)
    ↓
Controllers Layer (Request Handling)
    ↓
Services Layer (Business Logic)
    ↓
Provider Adapters (External API Integration)
```

### Key Components

1. **Provider Adapters** - Handle provider-specific API formats
   - `BaseProviderAdapter.ts` - Abstract base class
   - `OpenAIAdapter.ts` - OpenAI integration
   - `AnthropicAdapter.ts` - Anthropic integration
   - `GoogleAdapter.ts` - Google Gemini integration
   - `ProviderFactory.ts` - Factory for creating adapters

2. **Services** - Business logic layer
   - `providerValidation.service.ts` - API key validation
   - `modelFetching.service.ts` - Model retrieval
   - `chatCompletion.service.ts` - Chat completions with retry logic
   - `contextStrategy.service.ts` - Message filtering strategies

3. **Controllers** - HTTP request handlers
   - `providers.controller.ts` - Provider validation and model fetching
   - `chat.controller.ts` - Chat completion handling

4. **Routes** - Endpoint definitions with validation
   - `providers.routes.ts` - Provider endpoints
   - `chat.routes.ts` - Chat endpoints

## Endpoints

### 1. Validate API Key

**Endpoint:** `POST /api/providers/validate`

**Purpose:** Validate an API key for a specific provider

**Request Body:**
```json
{
  "provider": "openai",
  "apiKey": "sk-xxx"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "provider": "openai",
    "message": "API key is valid",
    "details": {
      "models": 50,
      "organization": "default"
    }
  }
}
```

**Response (Invalid Key):**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "provider": "openai",
    "message": "Invalid API key"
  }
}
```

**Supported Providers:**
- `openai` - OpenAI GPT models
- `anthropic` - Anthropic Claude models
- `google` - Google Gemini models

---

### 2. Fetch Models

**Endpoint:** `POST /api/providers/models`

**Purpose:** Fetch available models for a provider

**Request Body:**
```json
{
  "provider": "openai",
  "apiKey": "sk-xxx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "openai",
    "models": [
      {
        "id": "gpt-4o",
        "name": "gpt-4o",
        "description": "OpenAI gpt-4o",
        "contextWindow": 128000
      },
      {
        "id": "gpt-4o-mini",
        "name": "gpt-4o-mini",
        "description": "OpenAI gpt-4o-mini",
        "contextWindow": 128000
      }
    ],
    "count": 2
  }
}
```

---

### 3. Chat Completion

**Endpoint:** `POST /api/chat/completions`

**Purpose:** Send a chat completion request to an AI provider

**Request Body:**
```json
{
  "provider": "openai",
  "apiKey": "sk-xxx",
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Explain transformers" }
  ],
  "contextStrategy": "minimal",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "message": {
      "role": "assistant",
      "content": "Transformers are a type of neural network architecture..."
    },
    "usage": {
      "promptTokens": 10,
      "completionTokens": 150,
      "totalTokens": 160
    },
    "finishReason": "stop"
  }
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| provider | string | Yes | Provider name (openai, anthropic, google) |
| apiKey | string | Yes | API key for the provider |
| model | string | Yes | Model ID to use |
| messages | array | Yes | Array of chat messages |
| contextStrategy | string | No | Context strategy (minimal, recent, full) - default: minimal |
| temperature | number | No | Temperature (0-2) - default: 0.7 |
| maxTokens | number | No | Maximum tokens to generate |

**Message Format:**
```json
{
  "role": "system" | "user" | "assistant",
  "content": "message text"
}
```

## Context Strategies

The chat completion endpoint supports three context strategies:

### 1. Minimal (Default)
- Sends only the last user message
- Includes system message if present
- Best for: Simple, stateless queries
- Example use case: Single question-answer

### 2. Recent
- Sends last 10 messages (configurable)
- Includes system message if present
- Best for: Short-term conversation context
- Example use case: Multi-turn conversation with limited history

### 3. Full
- Sends entire conversation history
- Best for: Complete context preservation
- Example use case: Long conversations requiring full context

## Error Handling

### Retry Logic

The chat completion service includes automatic retry logic:
- **Max Retries:** 3
- **Retry Delay:** 1000ms
- **Retry Conditions:**
  - Server errors (5xx)
  - Network issues
- **No Retry:**
  - Authentication errors (401, 403)
  - Validation errors (400)

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

## Provider-Specific Details

### OpenAI
- **Base URL:** `https://api.openai.com/v1`
- **Authentication:** Bearer token in Authorization header
- **Validation Method:** GET /v1/models
- **Models Endpoint:** GET /v1/models (filtered for GPT models)
- **Chat Endpoint:** POST /v1/chat/completions

### Anthropic
- **Base URL:** `https://api.anthropic.com/v1`
- **Authentication:** x-api-key header
- **API Version:** 2023-06-01
- **Validation Method:** Test message request
- **Models:** Predefined list (no models endpoint)
- **Chat Endpoint:** POST /v1/messages
- **Special Handling:** System messages sent separately

### Google (Gemini)
- **Base URL:** `https://generativelanguage.googleapis.com/v1beta`
- **Authentication:** API key in query parameter
- **Validation Method:** GET /models
- **Models Endpoint:** GET /models (filtered for Gemini models)
- **Chat Endpoint:** POST /models/{model}:generateContent
- **Special Handling:** Message format conversion (role mapping)

## Testing

### Test with cURL

#### 1. Validate OpenAI API Key
```bash
curl -X POST http://localhost:8080/api/providers/validate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-api-key"
  }'
```

#### 2. Fetch OpenAI Models
```bash
curl -X POST http://localhost:8080/api/providers/models \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-api-key"
  }'
```

#### 3. Send Chat Completion
```bash
curl -X POST http://localhost:8080/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-api-key",
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "What is AI?"}
    ],
    "contextStrategy": "minimal"
  }'
```

## Security Considerations

1. **API Keys Not Stored:** All API keys are used only for the duration of the request
2. **No Database Storage:** No conversation data or API keys are stored
3. **Validation:** All inputs are validated using express-validator
4. **Error Handling:** Errors are caught and formatted appropriately
5. **CORS:** Configured in server.ts for allowed origins

## Adding New Providers

To add a new provider:

1. Create a new adapter class extending `BaseProviderAdapter`
2. Implement required methods:
   - `validateApiKey()`
   - `fetchModels()`
   - `sendChatCompletion()`
   - `normalizeResponse()`
3. Add provider to `ProviderFactory`
4. Update type definitions in `providerTypes.ts`
5. Update route validation to include new provider

## File Structure

```
src/
├── types/
│   └── providerTypes.ts          # Type definitions
├── services/
│   ├── providers/
│   │   ├── BaseProviderAdapter.ts
│   │   ├── OpenAIAdapter.ts
│   │   ├── AnthropicAdapter.ts
│   │   ├── GoogleAdapter.ts
│   │   └── ProviderFactory.ts
│   ├── providerValidation.service.ts
│   ├── modelFetching.service.ts
│   ├── chatCompletion.service.ts
│   └── contextStrategy.service.ts
├── controllers/
│   ├── providers.controller.ts
│   └── chat.controller.ts
└── routes/
    ├── providers.routes.ts
    └── chat.routes.ts
```

## Dependencies

- **axios** - HTTP client for making requests to external APIs
- **express-validator** - Request validation middleware

## Performance Considerations

1. **No Caching:** Each request hits the provider API directly
2. **Retry Delays:** 1 second delay between retries may impact response time
3. **Token Estimation:** Rough estimation (4 chars per token) for context strategies
4. **Concurrent Requests:** No rate limiting implemented (relies on provider limits)

## Future Enhancements

Potential improvements:
1. Add streaming support for chat completions
2. Implement response caching
3. Add rate limiting per provider
4. Support for more providers (Cohere, Mistral, etc.)
5. Add conversation history management
6. Implement token counting optimization
7. Add cost tracking per request
