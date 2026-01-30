# 🎯 SOVEREIGN AI - ENTITLEMENT SYSTEM FINAL SPECIFICATION

**Version:** 1.0  
**Date:** January 27, 2026  
**Status:** Implementation Ready  

---

## 📋 TABLE OF CONTENTS

1. [Database Schema](#1-database-schema)
2. [Dummy Data Examples](#2-dummy-data-examples)
3. [Snapshot Generation Logic](#3-snapshot-generation-logic)
4. [API Contracts](#4-api-contracts)
5. [Stripe Integration Flow](#5-stripe-integration-flow)
6. [User Lifecycle Flows](#6-user-lifecycle-flows)
7. [Edge Cases & Business Rules](#7-edge-cases--business-rules)
8. [Offline Sync Mechanism](#8-offline-sync-mechanism)
9. [Security & Tampering Protection](#9-security--tampering-protection)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1️⃣ DATABASE SCHEMA

### **1.1 Table: `plans`**

Commercial plan information (pricing, billing).

```typescript
{
  _id: ObjectId,
  name: String,                    // "free" | "pro" | "business" | "enterprise"
  display_name: String,            // "Free Plan" | "Pro Plan"
  price_monthly: Number,           // 0, 19, 49, null (contact sales)
  price_yearly: Number,            // 0, 190, 490, null
  currency: String,                // "AUD"
  is_contact_sales: Boolean,       // true for Enterprise
  is_active: Boolean,              // true/false
  stripe_product_id: String,       // "prod_xxx"
  stripe_price_monthly_id: String, // "price_xxx"
  stripe_price_yearly_id: String,  // "price_yyy"
  created_at: Date,
  updated_at: Date
}
```

**Index:** `name` (unique)

---

### **1.2 Table: `entitlement_definitions`**

Master list of all possible entitlements (single source of truth).

```typescript
{
  _id: ObjectId,
  key: String,                     // "file.upload.max_size_mb"
  type: String,                    // "boolean" | "number" | "string" | "array" | "unlimited"
  category: String,                // "capabilities" | "limits" | "resources" | "deployment" | "users"
  description: String,
  default_value: Mixed,            // Fallback value
  created_at: Date
}
```

**Index:** `key` (unique)

**Purpose:**
- Validation (no typo bugs)
- Consistency across plans
- Auto-documentation

---

### **1.3 Table: `plan_entitlements`**

Maps plans to their entitlements (HEART of pricing logic).

```typescript
{
  _id: ObjectId,
  plan_id: ObjectId,               // Ref: plans
  entitlement_key: String,         // "compare.enabled"
  value: Mixed,                    // true | 100 | "unlimited" | ["openai", "anthropic"]
  created_at: Date,
  updated_at: Date
}
```

**Index:** `plan_id + entitlement_key` (unique compound)

**Important:** This is a FLAT key-value store. Server groups them into buckets during snapshot generation.

---

### **1.4 Table: `users` (Updated)**

```typescript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String,
  role: String,                    // "user" | "admin"
  status: String,                  // "active" | "disabled"
  
  // Subscription Info
  plan_id: ObjectId,               // Ref: plans
  subscription_status: String,     // "trial" | "active" | "past_due" | "cancelled" | "expired"
  subscription_ends_at: Date,      // Billing cycle end
  grace_period_until: Date,        // Payment failed grace period
  
  // Stripe References
  stripe_customer_id: String,
  stripe_subscription_id: String,
  
  // Offline Session Cache
  last_entitlement_sync: Date,
  
  // Onboarding
  onboarding_phase: String,
  
  created_at: Date,
  updated_at: Date
}
```

---

### **1.5 Table: `user_entitlement_overrides` (NEW)**

For special cases (enterprise custom deals, temporary unlocks).

```typescript
{
  _id: ObjectId,
  user_id: ObjectId,               // Ref: users
  entitlement_key: String,         // "models.api.max"
  value: Mixed,                    // 20 (instead of plan's 10)
  reason: String,                  // "Enterprise custom deal"
  expires_at: Date,                // Optional: temporary override
  created_by: ObjectId,            // Admin who granted
  created_at: Date
}
```

**Index:** `user_id + entitlement_key` (compound)

**Use Cases:**
- Enterprise client wants 10 users instead of 3
- Beta tester gets temporary compare access
- VIP user gets unlimited models

---

### **1.6 Table: `entitlement_cache` (NEW)**

Stores generated snapshots for audit & offline recovery.

```typescript
{
  _id: ObjectId,
  user_id: ObjectId,               // Ref: users
  plan_id: ObjectId,               // Snapshot time ka plan
  snapshot: Object,                // Full resolved entitlements
  issued_at: Date,
  valid_until: Date,
  signature: String,               // HMAC for tampering protection
  client_synced: Boolean,          // Did client download?
  created_at: Date
}
```

**Index:** `user_id + issued_at` (compound, desc)

**Purpose:**
- Audit trail (user had what access when)
- Offline recovery (if local cache corrupted)
- Debugging (snapshot history)

---

## 2️⃣ DUMMY DATA EXAMPLES

### **2.1 Plans Collection**

```json
[
  {
    "_id": "plan_free_001",
    "name": "free",
    "display_name": "Free Plan",
    "price_monthly": 0,
    "price_yearly": 0,
    "currency": "AUD",
    "is_contact_sales": false,
    "is_active": true,
    "stripe_product_id": null,
    "stripe_price_monthly_id": null,
    "stripe_price_yearly_id": null
  },
  {
    "_id": "plan_pro_001",
    "name": "pro",
    "display_name": "Pro Plan",
    "price_monthly": 19,
    "price_yearly": 190,
    "currency": "AUD",
    "is_contact_sales": false,
    "is_active": true,
    "stripe_product_id": "prod_ProPlan2026",
    "stripe_price_monthly_id": "price_ProMonthly",
    "stripe_price_yearly_id": "price_ProYearly"
  },
  {
    "_id": "plan_business_001",
    "name": "business",
    "display_name": "Business Plan",
    "price_monthly": 49,
    "price_yearly": 490,
    "currency": "AUD",
    "is_contact_sales": false,
    "is_active": true,
    "stripe_product_id": "prod_BusinessPlan2026",
    "stripe_price_monthly_id": "price_BusinessMonthly",
    "stripe_price_yearly_id": "price_BusinessYearly"
  },
  {
    "_id": "plan_enterprise_001",
    "name": "enterprise",
    "display_name": "Enterprise Plan",
    "price_monthly": null,
    "price_yearly": null,
    "currency": "AUD",
    "is_contact_sales": true,
    "is_active": true,
    "stripe_product_id": null,
    "stripe_price_monthly_id": null,
    "stripe_price_yearly_id": null
  }
]
```

---

### **2.2 Entitlement Definitions Collection**

```json
[
  // CAPABILITIES
  {
    "_id": "entdef_001",
    "key": "compare.enabled",
    "type": "boolean",
    "category": "capabilities",
    "description": "compare mode for model comparison",
    "default_value": false
  },
  {
    "_id": "entdef_002",
    "key": "client.mode.enabled",
    "type": "boolean",
    "category": "capabilities",
    "description": "Client hosting mode (multi-user)",
    "default_value": false
  },
  {
    "_id": "entdef_003",
    "key": "file.upload.enabled",
    "type": "boolean",
    "category": "capabilities",
    "description": "File upload feature",
    "default_value": true
  },
  {
    "_id": "entdef_004",
    "key": "prompt.manager.enabled",
    "type": "boolean",
    "category": "capabilities",
    "description": "Prompt library manager",
    "default_value": true
  },
  {
    "_id": "entdef_005",
    "key": "web.search.enabled",
    "type": "boolean",
    "category": "capabilities",
    "description": "Web search integration",
    "default_value": true
  },
  {
    "_id": "entdef_006",
    "key": "model.local.enabled",
    "type": "boolean",
    "category": "capabilities",
    "description": "Local model support",
    "default_value": true
  },
  {
    "_id": "entdef_007",
    "key": "model.api.enabled",
    "type": "boolean",
    "category": "capabilities",
    "description": "API model support",
    "default_value": true
  },

  // LIMITS
  {
    "_id": "entdef_011",
    "key": "file.upload.daily.max",
    "type": "unlimited",
    "category": "limits",
    "description": "Max file uploads per day",
    "default_value": 5
  },
  {
    "_id": "entdef_012",
    "key": "file.upload.max_size_mb",
    "type": "unlimited",
    "category": "limits",
    "description": "Max file size in MB",
    "default_value": 10
  },
  {
    "_id": "entdef_013",
    "key": "prompt.saved.max",
    "type": "unlimited",
    "category": "limits",
    "description": "Max saved prompts",
    "default_value": 5
  },
  {
    "_id": "entdef_014",
    "key": "models.local.max",
    "type": "unlimited",
    "category": "limits",
    "description": "Max local models",
    "default_value": 1
  },
  {
    "_id": "entdef_015",
    "key": "models.api.max",
    "type": "unlimited",
    "category": "limits",
    "description": "Max API models",
    "default_value": 1
  },
  {
    "_id": "entdef_016",
    "key": "users.max",
    "type": "unlimited",
    "category": "limits",
    "description": "Max users/seats",
    "default_value": 1
  },

  // RESOURCES
  {
    "_id": "entdef_021",
    "key": "models.local.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed local model providers",
    "default_value": ["llama3"]
  },
  {
    "_id": "entdef_022",
    "key": "models.api.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed API providers",
    "default_value": ["openai"]
  },
  {
    "_id": "entdef_023",
    "key": "web.search.providers",
    "type": "array",
    "category": "resources",
    "description": "Allowed search providers",
    "default_value": ["duckduckgo"]
  },
  {
    "_id": "entdef_024",
    "key": "file.types.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed file types",
    "default_value": ["pdf", "txt", "docx"]
  },

  // DEPLOYMENT
  {
    "_id": "entdef_031",
    "key": "deployment.mode",
    "type": "string",
    "category": "deployment",
    "description": "Deployment mode",
    "default_value": "hybrid"
  },
  {
    "_id": "entdef_032",
    "key": "deployment.offline_cache_ttl_hours",
    "type": "number",
    "category": "deployment",
    "description": "Offline cache validity hours",
    "default_value": 12
  },
  {
    "_id": "entdef_033",
    "key": "deployment.local_enforcement_required",
    "type": "boolean",
    "category": "deployment",
    "description": "Local client must enforce limits",
    "default_value": true
  },
  {
    "_id": "entdef_034",
    "key": "deployment.client_hosting_enabled",
    "type": "boolean",
    "category": "deployment",
    "description": "Can host for other users",
    "default_value": false
  }
]
```

---

### **2.3 Plan Entitlements Collection**

#### **FREE PLAN**
```json
[
  { "plan_id": "plan_free_001", "entitlement_key": "compare.enabled", "value": false },
  { "plan_id": "plan_free_001", "entitlement_key": "client.mode.enabled", "value": false },
  { "plan_id": "plan_free_001", "entitlement_key": "file.upload.enabled", "value": true },
  { "plan_id": "plan_free_001", "entitlement_key": "prompt.manager.enabled", "value": true },
  { "plan_id": "plan_free_001", "entitlement_key": "web.search.enabled", "value": true },
  { "plan_id": "plan_free_001", "entitlement_key": "model.local.enabled", "value": true },
  { "plan_id": "plan_free_001", "entitlement_key": "model.api.enabled", "value": true },
  
  { "plan_id": "plan_free_001", "entitlement_key": "file.upload.daily.max", "value": 5 },
  { "plan_id": "plan_free_001", "entitlement_key": "file.upload.max_size_mb", "value": 10 },
  { "plan_id": "plan_free_001", "entitlement_key": "prompt.saved.max", "value": 5 },
  { "plan_id": "plan_free_001", "entitlement_key": "models.local.max", "value": 1 },
  { "plan_id": "plan_free_001", "entitlement_key": "models.api.max", "value": 1 },
  { "plan_id": "plan_free_001", "entitlement_key": "users.max", "value": 1 },
  
  { "plan_id": "plan_free_001", "entitlement_key": "models.local.allowed", "value": ["llama3"] },
  { "plan_id": "plan_free_001", "entitlement_key": "models.api.allowed", "value": ["openai"] },
  { "plan_id": "plan_free_001", "entitlement_key": "web.search.providers", "value": ["duckduckgo"] },
  { "plan_id": "plan_free_001", "entitlement_key": "file.types.allowed", "value": ["pdf", "txt", "docx"] },
  
  { "plan_id": "plan_free_001", "entitlement_key": "deployment.mode", "value": "hybrid" },
  { "plan_id": "plan_free_001", "entitlement_key": "deployment.offline_cache_ttl_hours", "value": 12 },
  { "plan_id": "plan_free_001", "entitlement_key": "deployment.local_enforcement_required", "value": true },
  { "plan_id": "plan_free_001", "entitlement_key": "deployment.client_hosting_enabled", "value": false }
]
```

#### **PRO PLAN**
```json
[
  { "plan_id": "plan_pro_001", "entitlement_key": "compare.enabled", "value": true },
  { "plan_id": "plan_pro_001", "entitlement_key": "client.mode.enabled", "value": false },
  { "plan_id": "plan_pro_001", "entitlement_key": "file.upload.enabled", "value": true },
  { "plan_id": "plan_pro_001", "entitlement_key": "prompt.manager.enabled", "value": true },
  { "plan_id": "plan_pro_001", "entitlement_key": "web.search.enabled", "value": true },
  { "plan_id": "plan_pro_001", "entitlement_key": "model.local.enabled", "value": true },
  { "plan_id": "plan_pro_001", "entitlement_key": "model.api.enabled", "value": true },
  
  { "plan_id": "plan_pro_001", "entitlement_key": "file.upload.daily.max", "value": "unlimited" },
  { "plan_id": "plan_pro_001", "entitlement_key": "file.upload.max_size_mb", "value": 30 },
  { "plan_id": "plan_pro_001", "entitlement_key": "prompt.saved.max", "value": 100 },
  { "plan_id": "plan_pro_001", "entitlement_key": "models.local.max", "value": 5 },
  { "plan_id": "plan_pro_001", "entitlement_key": "models.api.max", "value": 5 },
  { "plan_id": "plan_pro_001", "entitlement_key": "users.max", "value": 1 },
  
  { "plan_id": "plan_pro_001", "entitlement_key": "models.local.allowed", "value": ["llama3", "mistral", "phi"] },
  { "plan_id": "plan_pro_001", "entitlement_key": "models.api.allowed", "value": ["openai", "anthropic"] },
  { "plan_id": "plan_pro_001", "entitlement_key": "web.search.providers", "value": ["duckduckgo"] },
  { "plan_id": "plan_pro_001", "entitlement_key": "file.types.allowed", "value": ["pdf", "txt", "docx", "csv"] },
  
  { "plan_id": "plan_pro_001", "entitlement_key": "deployment.mode", "value": "hybrid" },
  { "plan_id": "plan_pro_001", "entitlement_key": "deployment.offline_cache_ttl_hours", "value": 48 },
  { "plan_id": "plan_pro_001", "entitlement_key": "deployment.local_enforcement_required", "value": true },
  { "plan_id": "plan_pro_001", "entitlement_key": "deployment.client_hosting_enabled", "value": false }
]
```

#### **BUSINESS PLAN**
```json
[
  { "plan_id": "plan_business_001", "entitlement_key": "compare.enabled", "value": true },
  { "plan_id": "plan_business_001", "entitlement_key": "client.mode.enabled", "value": true },
  { "plan_id": "plan_business_001", "entitlement_key": "file.upload.enabled", "value": true },
  { "plan_id": "plan_business_001", "entitlement_key": "prompt.manager.enabled", "value": true },
  { "plan_id": "plan_business_001", "entitlement_key": "web.search.enabled", "value": true },
  { "plan_id": "plan_business_001", "entitlement_key": "model.local.enabled", "value": true },
  { "plan_id": "plan_business_001", "entitlement_key": "model.api.enabled", "value": true },
  
  { "plan_id": "plan_business_001", "entitlement_key": "file.upload.daily.max", "value": "unlimited" },
  { "plan_id": "plan_business_001", "entitlement_key": "file.upload.max_size_mb", "value": "unlimited" },
  { "plan_id": "plan_business_001", "entitlement_key": "prompt.saved.max", "value": "unlimited" },
  { "plan_id": "plan_business_001", "entitlement_key": "models.local.max", "value": "unlimited" },
  { "plan_id": "plan_business_001", "entitlement_key": "models.api.max", "value": "unlimited" },
  { "plan_id": "plan_business_001", "entitlement_key": "users.max", "value": 3 },
  
  { "plan_id": "plan_business_001", "entitlement_key": "models.local.allowed", "value": ["*"] },
  { "plan_id": "plan_business_001", "entitlement_key": "models.api.allowed", "value": ["*"] },
  { "plan_id": "plan_business_001", "entitlement_key": "web.search.providers", "value": ["duckduckgo"] },
  { "plan_id": "plan_business_001", "entitlement_key": "file.types.allowed", "value": ["*"] },
  
  { "plan_id": "plan_business_001", "entitlement_key": "deployment.mode", "value": "hybrid" },
  { "plan_id": "plan_business_001", "entitlement_key": "deployment.offline_cache_ttl_hours", "value": 72 },
  { "plan_id": "plan_business_001", "entitlement_key": "deployment.local_enforcement_required", "value": true },
  { "plan_id": "plan_business_001", "entitlement_key": "deployment.client_hosting_enabled", "value": true }
]
```

---

### **2.4 User Entitlement Overrides Example**

```json
[
  {
    "_id": "override_001",
    "user_id": "user_enterprise_abc",
    "entitlement_key": "users.max",
    "value": 10,
    "reason": "Enterprise custom deal - 10 seats",
    "expires_at": null,
    "created_by": "admin_001",
    "created_at": "2026-01-15T10:00:00Z"
  },
  {
    "_id": "override_002",
    "user_id": "user_beta_tester_xyz",
    "entitlement_key": "compare.enabled",
    "value": true,
    "reason": "Beta tester - temporary compare access",
    "expires_at": "2026-02-28T23:59:59Z",
    "created_by": "admin_001",
    "created_at": "2026-01-20T14:30:00Z"
  }
]
```

---

## 3️⃣ SNAPSHOT GENERATION LOGIC

### **3.1 Algorithm (Server-Side)**

```typescript
function generateEntitlementSnapshot(userId: string): EntitlementSnapshot {
  
  // STEP 1: Load user
  const user = await User.findById(userId).populate('plan_id');
  
  if (!user || !user.plan_id) {
    throw new Error('User or plan not found');
  }
  
  // STEP 2: Load plan entitlements (flat key-value)
  const planEntitlements = await PlanEntitlement.find({
    plan_id: user.plan_id._id
  });
  
  // STEP 3: Load user-specific overrides
  const userOverrides = await UserEntitlementOverride.find({
    user_id: userId,
    $or: [
      { expires_at: null },
      { expires_at: { $gt: new Date() } }
    ]
  });
  
  // STEP 4: Merge (overrides win)
  const merged = {};
  
  // Add plan defaults
  planEntitlements.forEach(ent => {
    merged[ent.entitlement_key] = ent.value;
  });
  
  // Apply overrides
  userOverrides.forEach(override => {
    merged[override.entitlement_key] = override.value;
  });
  
  // STEP 5: Group into 5 buckets
  const capabilities = {};
  const limits = {};
  const resources = {};
  const deployment = {};
  const users = {};
  
  for (const [key, value] of Object.entries(merged)) {
    const parts = key.split('.');
    const category = parts[0];
    
    if (key.startsWith('compare.') || key.startsWith('client.') || 
        key.startsWith('file.') || key.startsWith('prompt.') || 
        key.startsWith('web.') || key.startsWith('model.')) {
      
      if (typeof value === 'boolean') {
        capabilities[key.replace(/\./g, '_')] = value;
      } else if (key.includes('.max') || key.includes('_size_')) {
        limits[key.replace(/\./g, '_')] = value;
      } else if (key.includes('.allowed') || key.includes('.providers') || key.includes('.types')) {
        resources[key.replace(/\./g, '_')] = value;
      }
    }
    
    if (key.startsWith('deployment.')) {
      deployment[key.replace('deployment.', '').replace(/\./g, '_')] = value;
    }
    
    if (key.startsWith('users.')) {
      limits[key.replace(/\./g, '_')] = value;
    }
  }
  
  // STEP 6: Calculate TTL
  const ttlHours = deployment.offline_cache_ttl_hours || 12;
  const validUntil = new Date();
  validUntil.setHours(validUntil.getHours() + ttlHours);
  
  // STEP 7: Build snapshot
  const snapshot = {
    user: {
      id: user._id,
      email: user.email,
      plan: user.plan_id.name,
      role: user.role
    },
    entitlements: {
      capabilities,
      limits,
      resources,
      deployment
    },
    issued_at: new Date().toISOString(),
    valid_until: validUntil.toISOString(),
    offline_allowed: true
  };
  
  // STEP 8: Sign snapshot (HMAC)
  const signature = generateSignature(snapshot);
  
  // STEP 9: Cache snapshot
  await EntitlementCache.create({
    user_id: userId,
    plan_id: user.plan_id._id,
    snapshot,
    signature,
    issued_at: new Date(),
    valid_until: validUntil,
    client_synced: false
  });
  
  return { ...snapshot, signature };
}
```

---

### **3.2 Generated Snapshot Example (Free Plan User)**

```json
{
  "user": {
    "id": "user_123",
    "email": "demo@sovereign.ai",
    "plan": "free",
    "role": "user"
  },
  "entitlements": {
    "capabilities": {
      "compare_enabled": false,
      "client_mode_enabled": false,
      "file_upload_enabled": true,
      "prompt_manager_enabled": true,
      "web_search_enabled": true,
      "model_local_enabled": true,
      "model_api_enabled": true
    },
    "limits": {
      "file_upload_daily_max": 5,
      "file_upload_max_size_mb": 10,
      "prompt_saved_max": 5,
      "models_local_max": 1,
      "models_api_max": 1,
      "users_max": 1
    },
    "resources": {
      "models_local_allowed": ["llama3"],
      "models_api_allowed": ["openai"],
      "web_search_providers": ["duckduckgo"],
      "file_types_allowed": ["pdf", "txt", "docx"]
    },
    "deployment": {
      "mode": "hybrid",
      "offline_cache_ttl_hours": 12,
      "local_enforcement_required": true,
      "client_hosting_enabled": false
    }
  },
  "issued_at": "2026-01-27T10:30:00Z",
  "valid_until": "2026-01-27T22:30:00Z",
  "offline_allowed": true,
  "signature": "hmac_sha256_xyz123..."
}
```

---

### **3.3 Generated Snapshot Example (Pro Plan User)**

```json
{
  "user": {
    "id": "user_456",
    "email": "pro@sovereign.ai",
    "plan": "pro",
    "role": "user"
  },
  "entitlements": {
    "capabilities": {
      "compare_enabled": true,
      "client_mode_enabled": false,
      "file_upload_enabled": true,
      "prompt_manager_enabled": true,
      "web_search_enabled": true,
      "model_local_enabled": true,
      "model_api_enabled": true
    },
    "limits": {
      "file_upload_daily_max": "unlimited",
      "file_upload_max_size_mb": 30,
      "prompt_saved_max": 100,
      "models_local_max": 5,
      "models_api_max": 5,
      "users_max": 1
    },
    "resources": {
      "models_local_allowed": ["llama3", "mistral", "phi"],
      "models_api_allowed": ["openai", "anthropic"],
      "web_search_providers": ["duckduckgo"],
      "file_types_allowed": ["pdf", "txt", "docx", "csv"]
    },
    "deployment": {
      "mode": "hybrid",
      "offline_cache_ttl_hours": 48,
      "local_enforcement_required": true,
      "client_hosting_enabled": false
    }
  },
  "issued_at": "2026-01-27T10:30:00Z",
  "valid_until": "2026-01-29T10:30:00Z",
  "offline_allowed": true,
  "signature": "hmac_sha256_abc789..."
}
```

---

## 4️⃣ API CONTRACTS

### **4.1 POST /api/auth/login**

**Request:**
```json
{
  "email": "pro@sovereign.ai",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_456",
    "email": "pro@sovereign.ai",
    "plan": "pro",
    "role": "user"
  },
  "entitlements": {
    "capabilities": { ... },
    "limits": { ... },
    "resources": { ... },
    "deployment": { ... }
  },
  "issued_at": "2026-01-27T10:30:00Z",
  "valid_until": "2026-01-29T10:30:00Z",
  "offline_allowed": true,
  "signature": "hmac_sha256_abc789...",
  "sessionToken": "jwt_token_20_days",
  "refreshToken": "jwt_refresh_90_days"
}
```

**Notes:**
- `sessionToken` = 20 days (authentication)
- `valid_until` = Plan-based (12/48/72 hrs - authorization)
- Entitlements are fully resolved (no client-side merging needed)

---

### **4.2 POST /api/entitlements/sync**

**Purpose:** Client requests fresh entitlements (cache expired or force sync).

**Headers:**
```
Authorization: Bearer <sessionToken>
```

**Request:**
```json
{
  "last_sync": "2026-01-27T10:30:00Z",
  "current_signature": "hmac_sha256_abc789..."
}
```

**Response (No Change):**
```json
{
  "changed": false,
  "message": "Entitlements unchanged",
  "valid_until": "2026-01-29T10:30:00Z"
}
```

**Response (Changed - Plan Upgrade/Downgrade):**
```json
{
  "changed": true,
  "user": { ... },
  "entitlements": { ... },
  "issued_at": "2026-01-27T15:00:00Z",
  "valid_until": "2026-01-29T15:00:00Z",
  "offline_allowed": true,
  "signature": "hmac_sha256_new123..."
}
```

---

### **4.3 GET /api/entitlements/validate/:capability**

**Purpose:** Quick capability check (optional - can be done locally).

**Example:**
```
GET /api/entitlements/validate/compare.enabled
```

**Response:**
```json
{
  "allowed": true,
  "capability": "compare.enabled",
  "plan": "pro"
}
```

---

## 5️⃣ STRIPE INTEGRATION FLOW

### **5.1 Checkout Flow (Frontend → Stripe → Backend)**

```
1. User selects Pro Monthly plan in app
   ↓
2. Frontend calls: POST /api/payments/create-checkout-session
   {
     "plan_id": "plan_pro_001",
     "billing_period": "monthly"
   }
   ↓
3. Backend creates Stripe Checkout Session
   stripe.checkout.sessions.create({
     customer: user.stripe_customer_id,
     line_items: [{ price: "price_ProMonthly", quantity: 1 }],
     mode: 'subscription',
     success_url: 'app://payment-success',
     cancel_url: 'app://payment-cancel',
     metadata: {
       user_id: "user_123",
       plan_id: "plan_pro_001"
     }
   })
   ↓
4. Backend returns: { checkout_url: "https://checkout.stripe.com/..." }
   ↓
5. Frontend opens Stripe checkout (browser/webview)
   ↓
6. User enters payment info → Stripe processes
   ↓
7. Stripe sends webhook: checkout.session.completed
   ↓
8. Backend webhook handler updates DB:
   - user.subscription_status = "active"
   - user.plan_id = "plan_pro_001"
   - user.stripe_subscription_id = "sub_xyz"
   - user.subscription_ends_at = billing_period_end
   ↓
9. User returns to app → Next login gives Pro entitlements
```

---

### **5.2 Webhook Events (Backend Must Handle)**

#### **Event: `checkout.session.completed`**

**Payload:**
```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_xyz",
      "customer": "cus_abc",
      "subscription": "sub_123",
      "metadata": {
        "user_id": "user_123",
        "plan_id": "plan_pro_001"
      }
    }
  }
}
```

**Handler Logic:**
```typescript
await User.findByIdAndUpdate(metadata.user_id, {
  plan_id: metadata.plan_id,
  subscription_status: 'active',
  stripe_subscription_id: subscription_id,
  subscription_ends_at: subscription.current_period_end
});

// Invalidate cached entitlements (force re-sync on next login)
await EntitlementCache.deleteMany({ user_id: metadata.user_id });
```

---

#### **Event: `invoice.paid`**

**Purpose:** Recurring payment success.

**Handler Logic:**
```typescript
const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

await User.findOneAndUpdate(
  { stripe_subscription_id: subscription.id },
  {
    subscription_status: 'active',
    subscription_ends_at: subscription.current_period_end,
    grace_period_until: null  // Clear any grace period
  }
);
```

---

#### **Event: `invoice.payment_failed`**

**Purpose:** Payment failed (card declined, etc.).

**Handler Logic:**
```typescript
await User.findOneAndUpdate(
  { stripe_subscription_id: subscription_id },
  {
    subscription_status: 'past_due',
    grace_period_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days
  }
);

// Send email: "Payment failed, please update card"
```

**Entitlement Logic:**
```typescript
// During grace period → Keep sending paid plan entitlements
// But include warning flag

if (user.subscription_status === 'past_due' && new Date() < user.grace_period_until) {
  snapshot.billing_state = 'grace';
  snapshot.grace_expires = user.grace_period_until;
}

// After grace period → Downgrade to Free
if (user.subscription_status === 'past_due' && new Date() > user.grace_period_until) {
  await User.findByIdAndUpdate(user._id, {
    plan_id: FREE_PLAN_ID,
    subscription_status: 'expired'
  });
}
```

---

#### **Event: `customer.subscription.updated`**

**Purpose:** User upgraded/downgraded plan.

**Handler Logic:**
```typescript
const newPlan = await SubscriptionPlan.findOne({
  stripe_price_monthly_id: subscription.items.data[0].price.id
});

await User.findOneAndUpdate(
  { stripe_subscription_id: subscription.id },
  {
    plan_id: newPlan._id,
    subscription_ends_at: subscription.current_period_end
  }
);

// Invalidate cache
await EntitlementCache.deleteMany({ user_id: user._id });
```

---

#### **Event: `customer.subscription.deleted`**

**Purpose:** User cancelled subscription.

**Handler Logic:**
```typescript
await User.findOneAndUpdate(
  { stripe_subscription_id: subscription_id },
  {
    subscription_status: 'cancelled',
    subscription_ends_at: subscription.current_period_end  // Keep access till end
  }
);

// Note: Don't immediately downgrade plan_id
// Keep current plan till subscription_ends_at
```

**Entitlement Logic:**
```typescript
// If cancelled but still in paid period
if (user.subscription_status === 'cancelled' && new Date() < user.subscription_ends_at) {
  // Send current plan entitlements
  snapshot.billing_state = 'cancelled';
  snapshot.access_until = user.subscription_ends_at;
}

// After subscription_ends_at
if (new Date() > user.subscription_ends_at) {
  await User.findByIdAndUpdate(user._id, {
    plan_id: FREE_PLAN_ID,
    subscription_status: 'expired'
  });
}
```

---

## 6️⃣ USER LIFECYCLE FLOWS

### **6.1 Flow: New User Registration**

```
1. User signs up → POST /api/auth/register
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "SecurePass123"
   }
   ↓
2. Backend creates user:
   - plan_id = FREE_PLAN_ID (default)
   - subscription_status = "trial"
   - stripe_customer_id = null
   ↓
3. Response:
   {
     "user": { ... },
     "entitlements": { ... FREE PLAN ... },
     "sessionToken": "...",
     "refreshToken": "..."
   }
   ↓
4. Frontend stores entitlements in localStorage
   ↓
5. User explores Free features
```

---

### **6.2 Flow: User Upgrades to Pro**

```
1. User clicks "Upgrade to Pro" in app
   ↓
2. Frontend calls: POST /api/payments/create-checkout-session
   { "plan_id": "plan_pro_001", "billing_period": "monthly" }
   ↓
3. Backend creates Stripe session
   ↓
4. User completes payment on Stripe
   ↓
5. Stripe webhook: checkout.session.completed
   ↓
6. Backend updates user:
   - plan_id = plan_pro_001
   - subscription_status = "active"
   ↓
7. User returns to app, clicks "Sync" or logs in again
   ↓
8. POST /api/entitlements/sync
   ↓
9. Backend generates PRO entitlements snapshot
   ↓
10. Frontend updates localStorage, unlocks Pro features (compare, etc.)
```

---

### **6.3 Flow: User Downgrades (Pro → Free)**

```
1. User clicks "Cancel Subscription" in app
   ↓
2. Frontend calls: POST /api/subscriptions/cancel
   ↓
3. Backend calls: stripe.subscriptions.update(sub_id, { cancel_at_period_end: true })
   ↓
4. Stripe webhook: customer.subscription.updated
   ↓
5. Backend updates:
   - subscription_status = "cancelled"
   - subscription_ends_at = current_period_end (e.g., Feb 27)
   ↓
6. User still has Pro access till Feb 27
   ↓
7. User logs in on Feb 25:
   - Snapshot still shows Pro entitlements
   - But includes: "billing_state": "cancelled", "access_until": "2026-02-27"
   ↓
8. User logs in on Feb 28:
   - Backend checks: new Date() > subscription_ends_at
   - Updates user.plan_id = FREE_PLAN_ID
   - Generates Free plan snapshot
   ↓
9. User now has Free limits
```

---

### **6.4 Flow: Payment Failed (Grace Period)**

```
1. Stripe tries to charge card on Feb 1 → Fails
   ↓
2. Stripe webhook: invoice.payment_failed
   ↓
3. Backend updates:
   - subscription_status = "past_due"
   - grace_period_until = Feb 8 (7 days)
   ↓
4. User logs in on Feb 3:
   - Backend sees: past_due + within grace period
   - Still sends Pro entitlements
   - But includes: "billing_state": "grace", "grace_expires": "Feb 8"
   ↓
5. Frontend shows banner: "Payment failed. Update card by Feb 8."
   ↓
6. User updates card → Stripe charges → invoice.paid webhook
   ↓
7. Backend clears grace period, subscription_status = "active"
   ↓
8. (Alternative) User doesn't update card, logs in on Feb 9:
   - Backend sees: past_due + grace expired
   - Downgrades to Free plan
   - Sends Free entitlements
```

---

### **6.5 Flow: Offline User During Plan Change**

```
Day 1, 10:00 AM: User (Pro plan) logs in → Gets 48hr cache
Day 2, 2:00 PM: Admin downgrades user to Free (manually)
Day 2, 5:00 PM: User works offline (still has Pro cache valid)
Day 3, 11:00 AM: User opens app offline
   - Local engine checks: valid_until = Day 3, 10:00 AM (expired!)
   - App shows: "Please connect to sync your account"
   - Blocks premium features OR continues with Free fallback
   ↓
User connects to internet
   ↓
App calls: POST /api/entitlements/sync
   ↓
Backend generates Free plan snapshot
   ↓
App updates localStorage, removes Pro features
```

**Key:** TTL prevents abuse, forces periodic check-ins.

---

## 7️⃣ EDGE CASES & BUSINESS RULES

### **7.1 Entitlement Overflow (After Downgrade)**

**Scenario:** Pro user saved 80 prompts, downgrades to Free (limit = 5).

**Industry Best Practice:**
- ❌ Don't delete user data
- ✅ Read-only mode for overflow

**Implementation:**

**Backend Check:**
```typescript
// Before allowing new prompt save
const userPrompts = await Prompt.countDocuments({ user_id: userId });
const limit = entitlements.limits.prompt_saved_max;

if (limit !== "unlimited" && userPrompts >= limit) {
  throw new AppError(
    `You've reached your plan limit (${limit} prompts). Upgrade to save more.`,
    403,
    'LIMIT_EXCEEDED'
  );
}
```

**Frontend Behavior:**
- Show all 80 prompts (read-only)
- Disable "Save New Prompt" button
- Show upgrade CTA: "Upgrade to Pro to save more prompts"

---

### **7.2 Model Access After Downgrade**

**Scenario:** Pro user has 3 API models configured (OpenAI, Anthropic, Perplexity). Downgrades to Free (allowed = ["openai"]).

**Backend Logic:**
```typescript
const configuredModels = await UserModel.find({ user_id: userId });
const allowedProviders = entitlements.resources.models_api_allowed;

configuredModels.forEach(model => {
  if (!allowedProviders.includes(model.provider) && !allowedProviders.includes("*")) {
    model.is_active = false;  // Disable, don't delete
  }
});
```

**Frontend:**
- Greys out Anthropic and Perplexity
- Shows: "Available in Pro plan"
- User can still see config but can't use

---

### **7.3 Wildcard Resource Handling**

**Scenario:** Business plan allows `models.api.allowed = ["*"]`.

**Backend Check:**
```typescript
function isModelAllowed(provider: string, allowedList: string[]): boolean {
  return allowedList.includes("*") || allowedList.includes(provider);
}

// Usage
if (!isModelAllowed("perplexity", entitlements.resources.models_api_allowed)) {
  throw new AppError("Model not allowed in your plan", 403);
}
```

---

### **7.4 Unlimited Limit Handling**

**Scenario:** Pro user has `file.upload.daily.max = "unlimited"`.

**Backend Check:**
```typescript
function checkLimit(current: number, max: number | "unlimited"): boolean {
  if (max === "unlimited") return true;
  return current < max;
}

// Usage
const dailyUploads = await FileUpload.countDocuments({
  user_id: userId,
  created_at: { $gte: startOfDay }
});

if (!checkLimit(dailyUploads, entitlements.limits.file_upload_daily_max)) {
  throw new AppError("Daily upload limit exceeded", 429);
}
```

---

### **7.5 Multi-User Business Plan**

**Scenario:** Business plan allows `users.max = 3` with client hosting.

**Backend Logic:**

**On Client Connect:**
```typescript
// Business user hosts local server
const hostUser = await User.findById(hostUserId);

if (!hostUser.entitlements.deployment.client_hosting_enabled) {
  throw new AppError("Client hosting not available in your plan", 403);
}

// Check connected users
const connectedUsers = await Session.countDocuments({
  host_user_id: hostUserId,
  status: 'active'
});

if (connectedUsers >= hostUser.entitlements.limits.users_max) {
  throw new AppError(`Maximum users (${hostUser.entitlements.limits.users_max}) reached`, 403);
}
```

---

### **7.6 Expired Offline Cache Handling**

**Client-Side Logic:**
```typescript
// On app startup
const cachedSnapshot = localStorage.getItem('entitlements');
const validUntil = new Date(cachedSnapshot.valid_until);
const now = new Date();

if (now > validUntil) {
  // Cache expired
  if (navigator.onLine) {
    // Online → Sync immediately
    const freshSnapshot = await api.post('/entitlements/sync');
    localStorage.setItem('entitlements', JSON.stringify(freshSnapshot));
  } else {
    // Offline → Degrade gracefully
    showNotification('Please connect to sync your account');
    
    // Option 1: Block all features
    disableApp();
    
    // Option 2: Allow basic features with Free fallback
    useFallbackEntitlements(FREE_PLAN_DEFAULTS);
  }
}
```

---

## 8️⃣ OFFLINE SYNC MECHANISM

### **8.1 Client-Side Storage Structure**

**localStorage Schema:**
```typescript
{
  "entitlements": {
    "user": { ... },
    "entitlements": { ... },
    "issued_at": "2026-01-27T10:30:00Z",
    "valid_until": "2026-01-29T10:30:00Z",
    "offline_allowed": true,
    "signature": "hmac_sha256_..."
  },
  "sessionToken": "jwt_20_days",
  "refreshToken": "jwt_90_days"
}
```

---

### **8.2 Sync Trigger Points**

**1. On App Startup (Always Check)**
```typescript
if (cacheExpired || !cachedSnapshot) {
  if (online) await syncEntitlements();
  else showSyncRequired();
}
```

**2. Periodic Background Sync (Every 6 Hours)**
```typescript
setInterval(async () => {
  if (navigator.onLine && shouldSync()) {
    await syncEntitlements();
  }
}, 6 * 60 * 60 * 1000);
```

**3. Manual Sync Button**
```typescript
<button onClick={syncEntitlements}>Refresh Subscription</button>
```

**4. After Payment Success**
```typescript
// User returns from Stripe checkout
window.location = 'app://payment-success';
await syncEntitlements();  // Get upgraded plan immediately
```

**5. On Network Reconnect**
```typescript
window.addEventListener('online', async () => {
  if (cacheExpired) {
    await syncEntitlements();
  }
});
```

---

### **8.3 Sync Logic (Client)**

```typescript
async function syncEntitlements() {
  try {
    const cached = localStorage.getItem('entitlements');
    
    const response = await fetch('/api/entitlements/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        last_sync: cached?.issued_at,
        current_signature: cached?.signature
      })
    });
    
    const data = await response.json();
    
    if (data.changed) {
      // New entitlements
      localStorage.setItem('entitlements', JSON.stringify(data));
      
      // Trigger UI update
      window.dispatchEvent(new Event('entitlementsUpdated'));
      
      // Show notification
      showNotification('Subscription updated');
    } else {
      // No change, just extend TTL
      cached.valid_until = data.valid_until;
      localStorage.setItem('entitlements', JSON.stringify(cached));
    }
    
  } catch (error) {
    console.error('Sync failed:', error);
    showNotification('Failed to sync. Retrying...');
    
    // Retry after 30 seconds
    setTimeout(syncEntitlements, 30000);
  }
}
```

---

### **8.4 Offline Enforcement (Client)**

```typescript
// Example: File upload check
function canUploadFile(fileSize: number) {
  const entitlements = JSON.parse(localStorage.getItem('entitlements'));
  
  // Check if cache valid
  if (new Date() > new Date(entitlements.valid_until)) {
    throw new Error('Subscription cache expired. Please connect to sync.');
  }
  
  // Verify signature (prevent tampering)
  if (!verifySignature(entitlements)) {
    throw new Error('Invalid entitlements. Please re-login.');
  }
  
  // Check capability
  if (!entitlements.entitlements.capabilities.file_upload_enabled) {
    throw new Error('File upload not available in your plan');
  }
  
  // Check limit
  const maxSize = entitlements.entitlements.limits.file_upload_max_size_mb;
  if (maxSize !== "unlimited" && fileSize > maxSize * 1024 * 1024) {
    throw new Error(`File too large. Max: ${maxSize}MB`);
  }
  
  return true;
}
```

---

## 9️⃣ SECURITY & TAMPERING PROTECTION

### **9.1 Snapshot Signature (HMAC)**

**Server-Side Generation:**
```typescript
import crypto from 'crypto';

function generateSignature(snapshot: object): string {
  const payload = JSON.stringify({
    user_id: snapshot.user.id,
    plan: snapshot.user.plan,
    issued_at: snapshot.issued_at,
    valid_until: snapshot.valid_until,
    entitlements: snapshot.entitlements
  });
  
  const hmac = crypto.createHmac('sha256', process.env.ENTITLEMENT_SECRET);
  hmac.update(payload);
  
  return hmac.digest('hex');
}
```

**Client-Side Verification:**
```typescript
function verifySignature(snapshot: object): boolean {
  const payload = JSON.stringify({
    user_id: snapshot.user.id,
    plan: snapshot.user.plan,
    issued_at: snapshot.issued_at,
    valid_until: snapshot.valid_until,
    entitlements: snapshot.entitlements
  });
  
  // Send to server for verification (or use WebCrypto API)
  const expectedSignature = computeHMAC(payload, ENTITLEMENT_PUBLIC_KEY);
  
  return snapshot.signature === expectedSignature;
}
```

---

### **9.2 Tampering Attack Scenarios**

#### **Attack 1: User edits localStorage**

```javascript
// Hacker tries
const entitlements = JSON.parse(localStorage.getItem('entitlements'));
entitlements.entitlements.capabilities.compare_enabled = true;
localStorage.setItem('entitlements', JSON.stringify(entitlements));
```

**Protection:**
- Signature won't match → Client detects tampering
- App blocks and forces re-login

---

#### **Attack 2: User extends valid_until**

```javascript
entitlements.valid_until = "2030-01-01";
```

**Protection:**
- Signature includes `valid_until` → Mismatch
- Even if signature bypassed, server enforces TTL on API calls

---

#### **Attack 3: Replay Old Premium Snapshot**

```javascript
// User had Pro before, saves old snapshot, replays after downgrade
localStorage.setItem('entitlements', oldProSnapshot);
```

**Protection:**
- Server marks old snapshots as revoked in `entitlement_cache`
- On sync, server checks: "Is this the latest issued snapshot?"
- If not → Force new snapshot download

---

### **9.3 Server-Side Enforcement (Ultimate Security)**

**Critical APIs Must Re-Validate:**

```typescript
// Middleware: Check entitlements on every critical request
export const enforceEntitlement = (capability: string) => {
  return async (req, res, next) => {
    const userId = req.user.userId;
    
    // Generate fresh snapshot (or use cached if recent)
    const snapshot = await generateEntitlementSnapshot(userId);
    
    if (!snapshot.entitlements.capabilities[capability]) {
      return res.status(403).json({
        error: 'Feature not available in your plan'
      });
    }
    
    next();
  };
};

// Usage
router.post('/compare/compare', 
  authenticateToken,
  enforceEntitlement('compare_enabled'),
  compareController
);
```

**Golden Rule:** Client-side enforcement = UX. Server-side enforcement = Security.

---

## 🔟 IMPLEMENTATION CHECKLIST

### **Phase 1: Database Setup**
- [ ] Create `plans` collection
- [ ] Create `entitlement_definitions` collection
- [ ] Create `plan_entitlements` collection
- [ ] Update `users` schema (add subscription fields)
- [ ] Create `user_entitlement_overrides` collection
- [ ] Create `entitlement_cache` collection
- [ ] Seed dummy data (Free, Pro, Business plans)
- [ ] Create indexes

### **Phase 2: Core Services**
- [ ] `entitlements.service.ts` - Snapshot generation logic
- [ ] `planInheritance.service.ts` - Merge plan + overrides
- [ ] Add HMAC signature generation/verification
- [ ] Update `stripe.service.ts` - Webhook handlers

### **Phase 3: API Endpoints**
- [ ] Update `POST /auth/login` - Return snapshot
- [ ] Update `POST /auth/register` - Default Free plan
- [ ] Create `POST /entitlements/sync`
- [ ] Create `GET /entitlements/validate/:capability`
- [ ] Update `POST /payments/create-checkout-session`
- [ ] Create `POST /webhooks/stripe` - Handle all events

### **Phase 4: Middleware & Enforcement**
- [ ] `enforceCapability(key)` middleware
- [ ] `checkLimit(key)` middleware
- [ ] `requireResource(type, id)` middleware
- [ ] Add to critical routes (compare, file upload, etc.)

### **Phase 5: Migration**
- [ ] Migrate existing `subscription_plans` → `plans` + `plan_entitlements`
- [ ] Assign existing users to Free plan
- [ ] Backfill Stripe customer IDs

### **Phase 6: Frontend Integration**
- [ ] Update login flow - Store entitlements in localStorage
- [ ] Implement sync logic (startup, periodic, manual)
- [ ] Add offline enforcement (signature verification)
- [ ] UI updates (hide/show features based on capabilities)
- [ ] Upgrade/downgrade CTAs

### **Phase 7: Testing**
- [ ] Unit tests - Snapshot generation
- [ ] Unit tests - Plan merging logic
- [ ] Integration tests - Stripe webhooks
- [ ] E2E tests - Login → Upgrade → Sync
- [ ] Offline mode testing
- [ ] Tampering attack tests

### **Phase 8: Monitoring & Logging**
- [ ] Log all entitlement syncs
- [ ] Alert on webhook failures
- [ ] Track plan usage metrics
- [ ] Audit trail for entitlement changes

---

## 📝 FINAL NOTES

### **Key Principles**

1. **Server is Source of Truth** - Client never computes entitlements
2. **Snapshots are Derived** - Not stored permanently, generated on demand
3. **TTL Prevents Abuse** - Offline cache expires, forces sync
4. **Downgrade at Cycle End** - Honor paid period fully
5. **Read-Only Overflow** - Never delete user data
6. **Signature Protection** - Detect tampering attempts
7. **Grace Periods** - Give users time to fix payment issues

### **What Makes This System Robust**

✅ **Scalable** - Flat key-value plan entitlements  
✅ **Flexible** - User overrides for custom deals  
✅ **Secure** - Signed snapshots, server enforcement  
✅ **Fair** - TTL prevents long-term offline abuse  
✅ **Offline-First** - Cached entitlements for hybrid app  
✅ **Audit Trail** - EntitlementCache logs all changes  

### **Next Steps**

1. **Review this spec** - Get team/stakeholder approval
2. **Start Phase 1** - Database schema setup
3. **Implement core logic** - Snapshot generation
4. **Test thoroughly** - All edge cases
5. **Deploy incrementally** - Feature flags for rollback

---

**Document Approved By:** _________________  
**Implementation Start Date:** _________________  
**Expected Completion:** _________________

---

**END OF SPECIFICATION**
