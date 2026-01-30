# 📮 Postman Testing Guide - Compare Mode

## 🚀 Prerequisites

1. **Server Running**: Make sure your backend is running
   ```bash
   npm run dev
   ```
   Server should be at: `http://localhost:8080` (or your configured PORT)

2. **API Keys Ready**: You'll need valid API keys for the providers you want to test

---

## 📍 Endpoint Details

**URL**: `http://localhost:8080/api/chat/compare`  
**Method**: `POST`  
**Content-Type**: `application/json`

---

## 🧪 Test Case 1: Basic Compare (2 Models)

### Postman Setup:

1. **Create New Request**
   - Click "New" → "HTTP Request"
   - Name it: "Compare Mode - Basic Test"

2. **Set Method & URL**
   - Method: `POST`
   - URL: `http://localhost:8080/api/chat/compare`

3. **Headers**
   - Key: `Content-Type`
   - Value: `application/json`

4. **Body** (select "raw" and "JSON")

```json
{
  "requestId": "test-123",
  "mode": "compare",
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": "What is Zero Trust Architecture? Explain in 2 sentences."
    }
  ],
  "contextStrategy": "minimal",
  "models": [
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKey": "sk-YOUR_OPENAI_KEY_HERE"
    },
    {
      "provider": "anthropic",
      "model": "claude-3-5-haiku-20241022",
      "apiKey": "sk-ant-YOUR_ANTHROPIC_KEY_HERE"
    }
  ]
}
```

5. **Important: Enable Event Stream**
   - This endpoint returns Server-Sent Events (SSE)
   - Postman will show progressive responses

---

## 🧪 Test Case 2: Multi-Model Compare (3+ Models)

```json
{
  "requestId": "test-456",
  "mode": "compare",
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing in simple terms"
    }
  ],
  "contextStrategy": "minimal",
  "models": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "sk-YOUR_OPENAI_KEY"
    },
    {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "apiKey": "sk-ant-YOUR_ANTHROPIC_KEY"
    },
    {
      "provider": "google",
      "model": "gemini-1.5-flash",
      "apiKey": "YOUR_GOOGLE_API_KEY"
    }
  ]
}
```

---

## 🧪 Test Case 3: With System Message

```json
{
  "requestId": "test-789",
  "mode": "compare",
  "stream": false,
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful technical expert. Keep responses concise."
    },
    {
      "role": "user",
      "content": "What is Docker?"
    }
  ],
  "contextStrategy": "minimal",
  "models": [
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKey": "sk-YOUR_OPENAI_KEY"
    },
    {
      "provider": "anthropic",
      "model": "claude-3-5-haiku-20241022",
      "apiKey": "sk-ant-YOUR_ANTHROPIC_KEY"
    }
  ]
}
```

---

## 📊 Expected Response Format

You'll receive **Server-Sent Events (SSE)** in this format:

### Event 1: model_response (as each model completes)
```
event: model_response
data: {
  "requestId": "test-123",
  "modelId": "gpt-4o-mini",
  "provider": "openai",
  "response": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "message": {
      "role": "assistant",
      "content": "Zero Trust Architecture is a security framework..."
    },
    "usage": {
      "promptTokens": 25,
      "completionTokens": 150,
      "totalTokens": 175
    },
    "finishReason": "stop"
  },
  "latency": 1200
}
```

### Event 2: model_response (second model)
```
event: model_response
data: {
  "requestId": "test-123",
  "modelId": "claude-3-5-haiku-20241022",
  "provider": "anthropic",
  "response": { ... },
  "latency": 800
}
```

### Event 3: compare_complete (all done)
```
event: compare_complete
data: {
  "requestId": "test-123",
  "totalModels": 2,
  "completedModels": 2
}
```

---

## ❌ Error Response Examples

### Invalid API Key
```
event: model_error
data: {
  "requestId": "test-123",
  "modelId": "gpt-4o-mini",
  "provider": "openai",
  "error": "Invalid API key"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "errors": [
      {
        "field": "models",
        "message": "At least 2 models are required for comparison"
      }
    ]
  }
}
```

---

## 🔍 How to View SSE in Postman

1. **Send the request**
2. **Response will stream in real-time**
3. Look for events like:
   - `event: model_response`
   - `event: model_error`
   - `event: compare_complete`

4. **Each event has a `data:` field** with JSON payload

---

## 🛠️ Troubleshooting

### Issue: "Cannot POST /api/chat/compare"
- ✅ Check server is running
- ✅ Verify URL is correct: `http://localhost:8080/api/chat/compare`

### Issue: "At least 2 models are required"
- ✅ Ensure `models` array has minimum 2 items

### Issue: "Invalid API key"
- ✅ Replace placeholder API keys with real ones
- ✅ Check API key format (OpenAI: `sk-...`, Anthropic: `sk-ant-...`)

### Issue: No response / timeout
- ✅ Check API keys are valid
- ✅ Check internet connection
- ✅ Verify provider endpoints are accessible

---

## 📝 Quick Test Checklist

- [ ] Server is running (`npm run dev`)
- [ ] Postman request created
- [ ] Method set to `POST`
- [ ] URL: `http://localhost:8080/api/chat/compare`
- [ ] Header: `Content-Type: application/json`
- [ ] Body: Valid JSON with 2+ models
- [ ] API keys replaced with real keys
- [ ] Send request and watch SSE events

---

## 🎯 Available Providers & Models

### OpenAI
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4-turbo`

### Anthropic
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`

### Google
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-2.0-flash-exp`

### Perplexity
- `sonar`
- `sonar-pro`
- `sonar-reasoning-pro`

---

## 💡 Pro Tips

1. **Start with 2 models** to test basic functionality
2. **Use cheaper models first** (gpt-4o-mini, claude-haiku)
3. **Keep prompts short** during testing to save costs
4. **Watch the latency field** to see which model is faster
5. **Test error handling** by using an invalid API key for one model

---

## 🔗 Related Endpoints

- Health Check: `GET http://localhost:8080/api/health`
- Single Chat: `POST http://localhost:8080/api/chat/completions`
- Validate Provider: `POST http://localhost:8080/api/providers/validate`
- Fetch Models: `POST http://localhost:8080/api/providers/models`
