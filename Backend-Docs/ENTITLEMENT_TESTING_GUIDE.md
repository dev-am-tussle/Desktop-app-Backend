# 🧪 ENTITLEMENT SYSTEM - POSTMAN TESTING GUIDE

**Version:** 1.0  
**Date:** January 28, 2026  
**Purpose:** Complete API testing workflow for entitlement system

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Test Data Setup](#test-data-setup)
3. [Testing Workflow](#testing-workflow)
4. [API Endpoint Tests](#api-endpoint-tests)
5. [Error Scenarios](#error-scenarios)
6. [Validation Checklist](#validation-checklist)

---

## ✅ PREREQUISITES

### Environment Variables
Ensure your `.env` file has:
```env
JWT_SECRET=sovereign_ai_secret_key_2025
JWT_REFRESH_SECRET=your_refresh_secret_key
AZURE_COSMOS_CONNECTIONSTRING=mongodb://localhost:27017/superportal
```

### Server Running
```bash
npm run dev
# or
npm start
```

### Postman Setup
1. Create new Postman Collection: "Sovereign AI - Entitlements"
2. Create Environment: "Local Dev"
3. Add variables:
   - `base_url`: `http://localhost:3000`
   - `sessionToken`: (will be set after login)
   - `userId`: (will be set after login)

---

## 🗄️ TEST DATA SETUP

### Step 1: Create Plans Manually

**POST** `{{base_url}}/api/subscriptions/create` (or create via MongoDB directly)

#### Free Plan
```json
{
  "name": "free",
  "display_name": "Free Plan",
  "slug": "free",
  "description": "Basic features for individual users",
  "price_monthly": 0,
  "price_yearly": 0,
  "currency": "AUD",
  "is_contact_sales": false,
  "status": "active",
  "sort_order": 1
}
```

#### Pro Plan
```json
{
  "name": "pro",
  "display_name": "Pro Plan",
  "slug": "pro",
  "description": "Advanced features for professionals",
  "price_monthly": 19.99,
  "price_yearly": 199,
  "currency": "AUD",
  "is_contact_sales": false,
  "status": "active",
  "sort_order": 2
}
```

#### Business Plan
```json
{
  "name": "business",
  "display_name": "Business Plan",
  "slug": "business",
  "description": "Complete features for teams",
  "price_monthly": 49.99,
  "price_yearly": 499,
  "currency": "AUD",
  "is_contact_sales": false,
  "status": "active",
  "sort_order": 3
}
```

#### Enterprise Plan
```json
{
  "name": "enterprise",
  "display_name": "Enterprise Plan",
  "slug": "enterprise",
  "description": "Custom solutions for organizations",
  "price_monthly": 0,
  "price_yearly": 0,
  "currency": "AUD",
  "is_contact_sales": true,
  "status": "active",
  "sort_order": 4
}
```

**Save Plan IDs for next steps!**

---

### Step 2: Create Entitlement Definitions

These will be created via MongoDB or direct API. Here are key ones to create:

**POST** `{{base_url}}/api/entitlements/definitions` (you may need to create this endpoint or use MongoDB Compass)

```json
[
  {
    "key": "features.compare_mode",
    "type": "boolean",
    "category": "capabilities",
    "description": "compare mode for model comparison",
    "default_value": false
  },
  {
    "key": "features.client_mode",
    "type": "boolean",
    "category": "capabilities",
    "description": "Client hosting mode",
    "default_value": false
  },
  {
    "key": "features.file_upload",
    "type": "boolean",
    "category": "capabilities",
    "description": "File upload feature",
    "default_value": true
  },
  {
    "key": "features.prompt_manager",
    "type": "boolean",
    "category": "capabilities",
    "description": "Prompt library manager",
    "default_value": true
  },
  {
    "key": "limits.file_uploads_per_day",
    "type": "number",
    "category": "limits",
    "description": "Max file uploads per day",
    "default_value": 5,
    "validation_rules": { "min": 0 }
  },
  {
    "key": "limits.file_size_mb",
    "type": "number",
    "category": "limits",
    "description": "Max file size in MB",
    "default_value": 10,
    "validation_rules": { "min": 1 }
  },
  {
    "key": "limits.prompts_saved",
    "type": "number",
    "category": "limits",
    "description": "Max saved prompts",
    "default_value": 5,
    "validation_rules": { "min": 1 }
  },
  {
    "key": "limits.models_local",
    "type": "number",
    "category": "limits",
    "description": "Max local models",
    "default_value": 1,
    "validation_rules": { "min": 1 }
  },
  {
    "key": "limits.models_api",
    "type": "number",
    "category": "limits",
    "description": "Max API models",
    "default_value": 1,
    "validation_rules": { "min": 1 }
  },
  {
    "key": "limits.users_max",
    "type": "number",
    "category": "limits",
    "description": "Max users/seats",
    "default_value": 1,
    "validation_rules": { "min": 1 }
  },
  {
    "key": "models.local.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed local model providers",
    "default_value": ["llama3"]
  },
  {
    "key": "models.api.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed API providers",
    "default_value": ["openai"]
  },
  {
    "key": "deployment.mode",
    "type": "string",
    "category": "deployment",
    "description": "Deployment mode",
    "default_value": "hybrid",
    "validation_rules": { "enum": ["cloud", "hybrid", "local"] }
  },
  {
    "key": "deployment.offline_cache_ttl_hours",
    "type": "number",
    "category": "deployment",
    "description": "Offline cache validity hours",
    "default_value": 12,
    "validation_rules": { "min": 1 }
  }
]
```

---

### Step 3: Create Plan Entitlements

Map plans to entitlements. Use MongoDB or create admin endpoint.

**Example for Free Plan:**
```json
[
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "features.compare_mode",
    "value": false
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "features.file_upload",
    "value": true
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "limits.file_uploads_per_day",
    "value": 5
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "limits.file_size_mb",
    "value": 10
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "limits.prompts_saved",
    "value": 5
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "limits.models_local",
    "value": 1
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "limits.models_api",
    "value": 1
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "models.local.allowed",
    "value": ["llama3"]
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "models.api.allowed",
    "value": ["openai"]
  },
  {
    "plan_id": "{{freePlanId}}",
    "entitlement_key": "deployment.offline_cache_ttl_hours",
    "value": 12
  }
]
```

**Example for Pro Plan:**
```json
[
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "features.compare_mode",
    "value": true
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "features.file_upload",
    "value": true
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "limits.file_uploads_per_day",
    "value": "unlimited"
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "limits.file_size_mb",
    "value": 30
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "limits.prompts_saved",
    "value": 100
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "limits.models_local",
    "value": 5
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "limits.models_api",
    "value": 5
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "models.local.allowed",
    "value": ["llama3", "mistral", "phi"]
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "models.api.allowed",
    "value": ["openai", "anthropic", "google"]
  },
  {
    "plan_id": "{{proPlanId}}",
    "entitlement_key": "deployment.offline_cache_ttl_hours",
    "value": 48
  }
]
```

---

## 🔄 TESTING WORKFLOW

### Phase 1: User Registration & Login

#### Test 1.1: Register New User
**POST** `{{base_url}}/api/auth/register`

**Body:**
```json
{
  "name": "Test User",
  "email": "test@sovereign.ai",
  "password": "Test@123"
}
```

**Expected Response:**
```json
{
  "data": {
    "user": {
      "id": "...",
      "name": "Test User",
      "email": "test@sovereign.ai",
      "role": "user",
      "status": "active",
      "onboardingPhase": "account_created"
    },
    "message": "User registered successfully"
  }
}
```

**Validation:**
- ✅ Status: 201 Created
- ✅ User gets default Free plan (check in MongoDB)
- ✅ `subscription_status` = "trial"

---

#### Test 1.2: Login User (Get Entitlements)
**POST** `{{base_url}}/api/auth/login`

**Body:**
```json
{
  "email": "test@sovereign.ai",
  "password": "Test@123"
}
```

**Expected Response:**
```json
{
  "data": {
    "user": {
      "id": "...",
      "name": "Test User",
      "email": "test@sovereign.ai",
      "role": "user",
      "status": "active",
      "onboardingPhase": "account_created"
    },
    "subscription": {
      "status": "none",
      "nextBillingDate": null,
      "plan": null
    },
    "authentication": {
      "sessionToken": "...",
      "refreshToken": "...",
      "expiresAt": "...",
      "sessionDuration": "30 days"
    },
    "entitlements": {
      "capabilities": {
        "features.compare_mode": false,
        "features.file_upload": true
      },
      "limits": {
        "limits.file_uploads_per_day": 5,
        "limits.file_size_mb": 10,
        "limits.prompts_saved": 5,
        "limits.models_local": 1,
        "limits.models_api": 1
      },
      "resources": {
        "models.local.allowed": ["llama3"],
        "models.api.allowed": ["openai"]
      },
      "deployment": {
        "mode": "hybrid",
        "offline_cache_ttl_hours": 12
      },
      "issued_at": "...",
      "valid_until": "...",
      "offline_allowed": true,
      "signature": "..."
    }
  }
}
```

**Postman Actions:**
1. Save `sessionToken` to environment variable
2. Save `userId` from response

**Validation:**
- ✅ Status: 200 OK
- ✅ Entitlements object present with all 5 categories
- ✅ Free plan limits applied
- ✅ `signature` field present (HMAC)
- ✅ `valid_until` = issued_at + 12 hours

---

### Phase 2: Entitlement Endpoints

#### Test 2.1: Get Current Entitlements
**GET** `{{base_url}}/api/entitlements`

**Headers:**
```
Authorization: Bearer {{sessionToken}}
```

**Expected Response:**
```json
{
  "message": "Entitlements retrieved successfully",
  "data": {
    "user_id": "...",
    "plan_id": "...",
    "plan_name": "free",
    "entitlements": { ... },
    "issued_at": "...",
    "valid_until": "...",
    "offline_allowed": true,
    "signature": "..."
  }
}
```

**Validation:**
- ✅ Status: 200 OK
- ✅ Returns cached snapshot if valid
- ✅ Signature matches

---

#### Test 2.2: Sync Entitlements
**POST** `{{base_url}}/api/entitlements/sync`

**Headers:**
```
Authorization: Bearer {{sessionToken}}
```

**Body:** (optional)
```json
{
  "last_sync": "2026-01-28T10:00:00Z",
  "current_signature": "abc123..."
}
```

**Expected Response:**
```json
{
  "message": "Entitlements synced successfully",
  "data": {
    "user_id": "...",
    "plan_name": "free",
    "entitlements": { ... },
    "issued_at": "...",
    "valid_until": "...",
    "signature": "..."
  }
}
```

**Validation:**
- ✅ Status: 200 OK
- ✅ New snapshot generated
- ✅ Old cache revoked in database

---

#### Test 2.3: Validate Capability
**GET** `{{base_url}}/api/entitlements/validate/features.compare_mode`

**Headers:**
```
Authorization: Bearer {{sessionToken}}
```

**Expected Response (Free User):**
```json
{
  "capability": "features.compare_mode",
  "allowed": false
}
```

**Validation:**
- ✅ Status: 200 OK
- ✅ `allowed: false` for Free plan

---

#### Test 2.4: Check Limit
**GET** `{{base_url}}/api/entitlements/check-limit/limits.file_uploads_per_day?currentUsage=3`

**Headers:**
```
Authorization: Bearer {{sessionToken}}
```

**Expected Response:**
```json
{
  "limitKey": "limits.file_uploads_per_day",
  "allowed": true,
  "limit": 5,
  "remaining": 2
}
```

**Validation:**
- ✅ Status: 200 OK
- ✅ Calculates remaining correctly (5 - 3 = 2)

---

### Phase 3: Chat Endpoints with Entitlements

#### Test 3.1: compare Mode (Should FAIL for Free User)
**POST** `{{base_url}}/api/chat/compare`

**Headers:**
```
Authorization: Bearer {{sessionToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "requestId": "test_123",
  "mode": "compare",
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": "What is AI?"
    }
  ],
  "models": [
    {
      "model": "gpt-4",
      "provider": "openai",
      "apiKey": "sk-test123"
    },
    {
      "model": "claude-3",
      "provider": "anthropic",
      "apiKey": "sk-ant-test123"
    }
  ]
}
```

**Expected Response:**
```json
{
  "error": "This feature requires the 'features.compare_mode' capability. Please upgrade your plan."
}
```

**Validation:**
- ✅ Status: 403 Forbidden
- ✅ Middleware blocks access
- ✅ Error message clear

---

#### Test 3.2: Regular Chat Completion
**POST** `{{base_url}}/api/chat/completions`

**Headers:**
```
Authorization: Bearer {{sessionToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "provider": "openai",
  "apiKey": "sk-test123",
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "temperature": 0.7,
  "maxTokens": 100
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "response": "...",
    "usage": { ... }
  }
}
```

**Validation:**
- ✅ Status: 200 OK
- ✅ Chat works for Free user (basic feature)

---

### Phase 4: Plan Upgrade Simulation

#### Test 4.1: Manually Update User to Pro Plan
**Via MongoDB Compass or Admin API:**
```javascript
db.users.updateOne(
  { email: "test@sovereign.ai" },
  {
    $set: {
      plan_id: ObjectId("{{proPlanId}}"),
      subscription_status: "active",
      subscription_ends_at: new Date("2026-02-28")
    }
  }
)
```

---

#### Test 4.2: Sync After Upgrade
**POST** `{{base_url}}/api/entitlements/sync`

**Headers:**
```
Authorization: Bearer {{sessionToken}}
```

**Expected Response:**
```json
{
  "message": "Entitlements synced successfully",
  "data": {
    "plan_name": "pro",
    "entitlements": {
      "capabilities": {
        "features.compare_mode": true  // ← Now enabled!
      },
      "limits": {
        "limits.file_uploads_per_day": "unlimited",
        "limits.file_size_mb": 30,
        "limits.prompts_saved": 100
      },
      "deployment": {
        "offline_cache_ttl_hours": 48  // ← Extended!
      }
    },
    "valid_until": "..."
  }
}
```

**Validation:**
- ✅ Plan changed to "pro"
- ✅ compare mode now `true`
- ✅ Limits upgraded
- ✅ TTL extended to 48 hours

---

#### Test 4.3: compare Mode (Should NOW SUCCEED)
**POST** `{{base_url}}/api/chat/compare`

(Same body as Test 3.1)

**Expected Response:**
```
event: model_response
data: {...}

event: model_response
data: {...}

event: compare_complete
data: {...}
```

**Validation:**
- ✅ Status: 200 OK
- ✅ SSE stream works
- ✅ Middleware allows access

---

### Phase 5: User Entitlement Overrides

#### Test 5.1: Create Override (Admin Action)
**Via MongoDB or Admin API:**
```json
{
  "user_id": "{{userId}}",
  "entitlement_key": "limits.models_api",
  "value": 10,
  "reason": "Beta tester - special access",
  "expires_at": "2026-02-28T23:59:59Z",
  "created_by": "admin_001"
}
```

Insert into `user_entitlement_overrides` collection.

---

#### Test 5.2: Sync After Override
**POST** `{{base_url}}/api/entitlements/sync`

**Expected Response:**
```json
{
  "data": {
    "entitlements": {
      "limits": {
        "limits.models_api": 10  // ← Override applied!
      }
    }
  }
}
```

**Validation:**
- ✅ Override value wins over plan value
- ✅ Other entitlements unchanged

---

### Phase 6: Edge Cases

#### Test 6.1: Expired Session Token
**GET** `{{base_url}}/api/entitlements`

(Use expired or invalid token)

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

**Validation:**
- ✅ Status: 401 Unauthorized

---

#### Test 6.2: Signature Verification
**POST** `{{base_url}}/api/entitlements/verify`

**Body:**
```json
{
  "snapshot": { ... },
  "userId": "{{userId}}",
  "issuedAt": "2026-01-28T10:00:00Z",
  "signature": "invalid_signature_123"
}
```

**Expected Response:**
```json
{
  "valid": false,
  "message": "Signature invalid or tampered"
}
```

**Validation:**
- ✅ Status: 200 OK
- ✅ Detects invalid signature

---

#### Test 6.3: Check Limit Exceeded
**GET** `{{base_url}}/api/entitlements/check-limit/limits.file_uploads_per_day?currentUsage=5`

**Expected Response (Free User):**
```json
{
  "limitKey": "limits.file_uploads_per_day",
  "allowed": false,
  "limit": 5,
  "remaining": 0
}
```

**Validation:**
- ✅ `allowed: false` when usage = limit

---

## ❌ ERROR SCENARIOS

### Test Error 1: Missing Authentication
**GET** `{{base_url}}/api/entitlements`

(No Authorization header)

**Expected:**
- Status: 401 Unauthorized

---

### Test Error 2: User Without Plan
Create user without plan_id, try to get entitlements.

**Expected:**
- Should auto-assign Free plan or throw error with clear message

---

### Test Error 3: Invalid Plan ID
Update user with non-existent plan_id, sync entitlements.

**Expected:**
- Error: "Plan not found"
- Status: 500 or 404

---

### Test Error 4: Capability Not in Database
**GET** `{{base_url}}/api/entitlements/validate/features.nonexistent_feature`

**Expected:**
- Returns default value (false) or error

---

## ✅ VALIDATION CHECKLIST

### Database Checks (MongoDB Compass)

- [ ] `plans` collection has 4 plans
- [ ] `entitlement_definitions` collection has all definitions
- [ ] `plan_entitlements` collection has mappings
- [ ] `users` collection has `plan_id`, `subscription_status`
- [ ] `entitlement_cache` collection stores snapshots
- [ ] `user_entitlement_overrides` collection (empty initially)

### API Response Checks

- [ ] Login returns full entitlement snapshot
- [ ] Sync endpoint generates new snapshot
- [ ] Validate endpoint checks capabilities correctly
- [ ] Check-limit calculates remaining properly
- [ ] Signature verification detects tampering

### Middleware Checks

- [ ] `requireCapability` blocks unauthorized access
- [ ] `authenticate` validates JWT properly
- [ ] compare endpoint blocked for Free users
- [ ] compare endpoint works for Pro users

### Business Logic Checks

- [ ] Free plan: 12hr TTL, compare disabled, 5 file limit
- [ ] Pro plan: 48hr TTL, compare enabled, unlimited files
- [ ] Overrides: Custom values win over plan defaults
- [ ] Cache: Old snapshots revoked on sync
- [ ] Signature: HMAC prevents tampering

### Edge Cases

- [ ] User without plan gets Free by default
- [ ] Expired session token rejected
- [ ] Invalid signature detected
- [ ] Limit exceeded returns allowed: false
- [ ] Upgrade/downgrade updates entitlements

---

## 📝 TESTING NOTES

### Common Issues

1. **Entitlements null on login:**
   - Check if plans exist in database
   - Check if plan_entitlements exist
   - Check entitlement definitions seeded

2. **Signature mismatch:**
   - Verify JWT_SECRET in .env
   - Check signature generation logic

3. **Middleware not blocking:**
   - Verify middleware order in routes
   - Check req.user populated by authenticate

4. **TTL not working:**
   - Check deployment.offline_cache_ttl_hours in plan entitlements
   - Verify valid_until calculation

---

## 🎯 SUCCESS CRITERIA

System is production-ready when:

✅ All 25+ tests pass  
✅ Free/Pro plans work correctly  
✅ compare mode blocks/allows based on plan  
✅ Entitlement sync updates properly  
✅ Overrides apply correctly  
✅ Signatures prevent tampering  
✅ Error handling clear and consistent  
✅ Performance acceptable (<500ms for snapshot generation)  

---

**Happy Testing! 🚀**
