# Supported Providers Endpoint Documentation

## 📍 New Endpoint Added

### GET `/api/providers/supported`

Returns the list of AI providers that are currently supported by the SovereignAI backend.

---

## 🎯 Purpose

This endpoint allows the frontend to dynamically fetch the list of supported providers before rendering dropdowns or selection UI. This ensures the UI always shows only the providers that the backend currently supports.

---

## 📥 Request

**Method**: `GET`  
**URL**: `/api/providers/supported`  
**Authentication**: None required  
**Body**: None

### Example Request

```bash
curl -X GET http://localhost:5000/api/providers/supported
```

---

## 📤 Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "providers": [
      "openai",
      "anthropic",
      "google",
      "perplexity"
    ],
    "count": 4
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful requests |
| `data.providers` | string[] | Array of supported provider names |
| `data.count` | number | Total number of supported providers |

---

## 🎨 Frontend Integration Example

### React/TypeScript Example

```typescript
import { useEffect, useState } from 'react';

interface SupportedProvidersResponse {
  success: boolean;
  data: {
    providers: string[];
    count: number;
  };
}

function ProviderSelector() {
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');

  useEffect(() => {
    // Fetch supported providers on component mount
    fetch('http://localhost:5000/api/providers/supported')
      .then(res => res.json())
      .then((data: SupportedProvidersResponse) => {
        setProviders(data.data.providers);
        // Optionally set first provider as default
        if (data.data.providers.length > 0) {
          setSelectedProvider(data.data.providers[0]);
        }
      })
      .catch(err => console.error('Failed to fetch providers:', err));
  }, []);

  return (
    <div>
      <label htmlFor="provider-select">Select AI Provider:</label>
      <select
        id="provider-select"
        value={selectedProvider}
        onChange={(e) => setSelectedProvider(e.target.value)}
      >
        <option value="">-- Select Provider --</option>
        {providers.map((provider) => (
          <option key={provider} value={provider}>
            {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Vanilla JavaScript Example

```javascript
// Fetch supported providers
async function loadProviders() {
  try {
    const response = await fetch('http://localhost:5000/api/providers/supported');
    const data = await response.json();
    
    const selectElement = document.getElementById('provider-dropdown');
    
    // Populate dropdown
    data.data.providers.forEach(provider => {
      const option = document.createElement('option');
      option.value = provider;
      option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading providers:', error);
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', loadProviders);
```

---

## 🔄 Updated Endpoints

All provider-related endpoints now support **Perplexity** in addition to OpenAI, Anthropic, and Google:

### 1. POST `/api/providers/validate`
- **Updated validation**: Now accepts `'perplexity'` as a valid provider

### 2. POST `/api/providers/models`
- **Updated validation**: Now accepts `'perplexity'` as a valid provider

### 3. POST `/api/chat/completions`
- **Updated validation**: Now accepts `'perplexity'` as a valid provider

---

## ✅ Benefits

1. **Dynamic UI**: Frontend doesn't need to hardcode provider list
2. **Maintainability**: Adding new providers only requires backend changes
3. **Consistency**: UI always matches backend capabilities
4. **User Experience**: Users only see providers that actually work
5. **No Authentication**: Public endpoint for easy access

---

## 🧪 Testing

### Using cURL

```bash
# Get supported providers
curl -X GET http://localhost:5000/api/providers/supported
```

### Using Postman

1. Create a new GET request
2. URL: `http://localhost:5000/api/providers/supported`
3. Send request
4. Verify response contains all 4 providers

### Using Browser

Simply navigate to:
```
http://localhost:5000/api/providers/supported
```

---

## 📝 Implementation Details

### Controller
- **File**: `src/controllers/providers.controller.ts`
- **Function**: `getSupportedProviders`
- **Logic**: Calls `ProviderFactory.getSupportedProviders()`

### Route
- **File**: `src/routes/providers.routes.ts`
- **Method**: GET
- **Path**: `/supported`
- **Validation**: None (public endpoint)

### Service
- **File**: `src/services/providers/ProviderFactory.ts`
- **Method**: `getSupportedProviders()`
- **Returns**: `['openai', 'anthropic', 'google', 'perplexity']`

---

## 🎯 Use Cases

1. **Dropdown Population**: Populate provider selection dropdowns
2. **Feature Flags**: Check if a specific provider is supported
3. **Documentation**: Auto-generate API documentation
4. **Validation**: Client-side validation before API calls
5. **Analytics**: Track which providers are available

---

## 🚀 Next Steps

1. ✅ Endpoint is ready to use
2. ✅ All validations updated to include Perplexity
3. ✅ No breaking changes to existing endpoints
4. 🎨 Update frontend to use this endpoint
5. 🎨 Remove hardcoded provider lists from frontend
