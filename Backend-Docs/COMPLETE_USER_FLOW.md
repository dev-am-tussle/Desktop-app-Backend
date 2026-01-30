# 🔄 COMPLETE USER FLOW - FRONTEND TO BACKEND TO DATABASE

**Date:** January 28, 2026  
**Purpose:** End-to-end user journey with exact API calls, database operations, and data flow

---

## 📋 TABLE OF CONTENTS

1. [Database Setup (One-Time)](#1-database-setup-one-time)
2. [User Registration Flow](#2-user-registration-flow)
3. [User Login Flow](#3-user-login-flow)
4. [Plan Selection & Payment Flow](#4-plan-selection--payment-flow)
5. [Entitlement Sync Flow](#5-entitlement-sync-flow)
6. [Feature Access Flow (compare Mode)](#6-feature-access-flow-compare-mode)
7. [File Upload Flow](#7-file-upload-flow)
8. [Plan Upgrade Flow](#8-plan-upgrade-flow)
9. [Offline Usage Flow](#9-offline-usage-flow)
10. [Complete Data Flow Diagram](#10-complete-data-flow-diagram)

---

## 1️⃣ DATABASE SETUP (ONE-TIME)

### **Collections to Create (Before First User)**

#### Collection 1: `subscriptionplans` ✅ One-Time

**Purpose:** Store all available subscription plans (pricing info only)

**Documents to Insert:**

```javascript
// Free Plan
{
  "_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"),
  "name": "free",
  "display_name": "Free Plan",
  "slug": "free",
  "description": "Basic features for individual users",
  "price_monthly": 0,
  "price_yearly": 0,
  "currency": "AUD",
  "is_contact_sales": false,
  "stripe_product_id": null,
  "stripe_price_monthly_id": null,
  "stripe_price_yearly_id": null,
  "status": "active",
  "sort_order": 1,
  "createdAt": ISODate("2026-01-28T00:00:00Z"),
  "updatedAt": ISODate("2026-01-28T00:00:00Z")
}

// Pro Plan
{
  "_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"),
  "name": "pro",
  "display_name": "Pro Plan",
  "slug": "pro",
  "description": "Advanced features for professionals",
  "price_monthly": 19.99,
  "price_yearly": 199,
  "currency": "AUD",
  "is_contact_sales": false,
  "stripe_product_id": "prod_ProPlan2026",
  "stripe_price_monthly_id": "price_ProMonthly",
  "stripe_price_yearly_id": "price_ProYearly",
  "status": "active",
  "sort_order": 2,
  "createdAt": ISODate("2026-01-28T00:00:00Z"),
  "updatedAt": ISODate("2026-01-28T00:00:00Z")
}

// Business Plan
{
  "_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j2"),
  "name": "business",
  "display_name": "Business Plan",
  "slug": "business",
  "description": "Complete features for teams",
  "price_monthly": 49.99,
  "price_yearly": 499,
  "currency": "AUD",
  "is_contact_sales": false,
  "stripe_product_id": "prod_BusinessPlan2026",
  "stripe_price_monthly_id": "price_BusinessMonthly",
  "stripe_price_yearly_id": "price_BusinessYearly",
  "status": "active",
  "sort_order": 3,
  "createdAt": ISODate("2026-01-28T00:00:00Z"),
  "updatedAt": ISODate("2026-01-28T00:00:00Z")
}

// Enterprise Plan
{
  "_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j3"),
  "name": "enterprise",
  "display_name": "Enterprise Plan",
  "slug": "enterprise",
  "description": "Custom solutions for organizations",
  "price_monthly": 0,
  "price_yearly": 0,
  "currency": "AUD",
  "is_contact_sales": true,
  "stripe_product_id": null,
  "stripe_price_monthly_id": null,
  "stripe_price_yearly_id": null,
  "status": "active",
  "sort_order": 4,
  "createdAt": ISODate("2026-01-28T00:00:00Z"),
  "updatedAt": ISODate("2026-01-28T00:00:00Z")
}
```

**How to Insert:** MongoDB Compass → Insert Documents (Bulk Insert)

---

#### Collection 2: `entitlementdefinitions` ✅ One-Time

**Purpose:** Master list of ALL possible entitlements (single source of truth)

**Documents to Insert:**

```javascript
[
  // CAPABILITIES (Boolean features)
  {
    "_id": ObjectId(),
    "key": "features.compare_mode",
    "type": "boolean",
    "category": "capabilities",
    "description": "compare mode for model comparison",
    "default_value": false,
    "validation_rules": null,
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "features.client_mode",
    "type": "boolean",
    "category": "capabilities",
    "description": "Client hosting mode (multi-user)",
    "default_value": false,
    "validation_rules": null,
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "features.file_upload",
    "type": "boolean",
    "category": "capabilities",
    "description": "File upload feature",
    "default_value": true,
    "validation_rules": null,
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "features.prompt_manager",
    "type": "boolean",
    "category": "capabilities",
    "description": "Prompt library manager",
    "default_value": true,
    "validation_rules": null,
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "features.web_search",
    "type": "boolean",
    "category": "capabilities",
    "description": "Web search integration",
    "default_value": true,
    "validation_rules": null,
    "createdAt": ISODate()
  },
  
  // LIMITS (Numeric limits or "unlimited")
  {
    "_id": ObjectId(),
    "key": "limits.file_uploads_per_day",
    "type": "number",
    "category": "limits",
    "description": "Max file uploads per day",
    "default_value": 5,
    "validation_rules": { "min": 0 },
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "limits.file_size_mb",
    "type": "number",
    "category": "limits",
    "description": "Max file size in MB",
    "default_value": 10,
    "validation_rules": { "min": 1, "max": 100 },
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "limits.prompts_saved",
    "type": "number",
    "category": "limits",
    "description": "Max saved prompts",
    "default_value": 5,
    "validation_rules": { "min": 1 },
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "limits.models_local",
    "type": "number",
    "category": "limits",
    "description": "Max local models",
    "default_value": 1,
    "validation_rules": { "min": 1 },
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "limits.models_api",
    "type": "number",
    "category": "limits",
    "description": "Max API models",
    "default_value": 1,
    "validation_rules": { "min": 1 },
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "limits.users_max",
    "type": "number",
    "category": "limits",
    "description": "Max users/seats",
    "default_value": 1,
    "validation_rules": { "min": 1 },
    "createdAt": ISODate()
  },
  
  // RESOURCES (Arrays - whitelists)
  {
    "_id": ObjectId(),
    "key": "models.local.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed local model providers",
    "default_value": ["llama3"],
    "validation_rules": null,
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "models.api.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed API providers",
    "default_value": ["openai"],
    "validation_rules": null,
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "web.search.providers",
    "type": "array",
    "category": "resources",
    "description": "Allowed search providers",
    "default_value": ["duckduckgo"],
    "validation_rules": null,
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "file.types.allowed",
    "type": "array",
    "category": "resources",
    "description": "Allowed file types",
    "default_value": ["pdf", "txt", "docx"],
    "validation_rules": null,
    "createdAt": ISODate()
  },
  
  // DEPLOYMENT (Configuration)
  {
    "_id": ObjectId(),
    "key": "deployment.mode",
    "type": "string",
    "category": "deployment",
    "description": "Deployment mode",
    "default_value": "hybrid",
    "validation_rules": { "enum": ["cloud", "hybrid", "local"] },
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "deployment.offline_cache_ttl_hours",
    "type": "number",
    "category": "deployment",
    "description": "Offline cache validity hours",
    "default_value": 12,
    "validation_rules": { "min": 1, "max": 720 },
    "createdAt": ISODate()
  },
  {
    "_id": ObjectId(),
    "key": "deployment.client_hosting_enabled",
    "type": "boolean",
    "category": "deployment",
    "description": "Can host for other users",
    "default_value": false,
    "validation_rules": null,
    "createdAt": ISODate()
  },
  
  // SUPPORT
  {
    "_id": ObjectId(),
    "key": "support.level",
    "type": "string",
    "category": "support",
    "description": "Support tier",
    "default_value": "community",
    "validation_rules": { "enum": ["community", "email", "priority", "dedicated"] },
    "createdAt": ISODate()
  }
]
```

**How to Insert:** MongoDB Compass → Insert Documents (Bulk Insert)

---

#### Collection 3: `planentitlements` ✅ One-Time

**Purpose:** Map each plan to its entitlements (HEART OF PRICING)

**Documents to Insert:**

```javascript
// FREE PLAN ENTITLEMENTS
[
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "features.compare_mode", "value": false, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "features.client_mode", "value": false, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "features.file_upload", "value": true, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "features.prompt_manager", "value": true, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "features.web_search", "value": true, "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "limits.file_uploads_per_day", "value": 5, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "limits.file_size_mb", "value": 10, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "limits.prompts_saved", "value": 5, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "limits.models_local", "value": 1, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "limits.models_api", "value": 1, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "limits.users_max", "value": 1, "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "models.local.allowed", "value": ["llama3"], "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "models.api.allowed", "value": ["openai"], "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "web.search.providers", "value": ["duckduckgo"], "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "file.types.allowed", "value": ["pdf", "txt", "docx"], "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "deployment.mode", "value": "hybrid", "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "deployment.offline_cache_ttl_hours", "value": 12, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "deployment.client_hosting_enabled", "value": false, "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), "entitlement_key": "support.level", "value": "community", "createdAt": ISODate(), "updatedAt": ISODate() }
]

// PRO PLAN ENTITLEMENTS
[
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "features.compare_mode", "value": true, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "features.client_mode", "value": false, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "features.file_upload", "value": true, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "features.prompt_manager", "value": true, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "features.web_search", "value": true, "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "limits.file_uploads_per_day", "value": "unlimited", "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "limits.file_size_mb", "value": 30, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "limits.prompts_saved", "value": 100, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "limits.models_local", "value": 5, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "limits.models_api", "value": 5, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "limits.users_max", "value": 1, "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "models.local.allowed", "value": ["llama3", "mistral", "phi"], "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "models.api.allowed", "value": ["openai", "anthropic", "google"], "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "web.search.providers", "value": ["duckduckgo"], "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "file.types.allowed", "value": ["pdf", "txt", "docx", "csv", "xlsx"], "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "deployment.mode", "value": "hybrid", "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "deployment.offline_cache_ttl_hours", "value": 48, "createdAt": ISODate(), "updatedAt": ISODate() },
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "deployment.client_hosting_enabled", "value": false, "createdAt": ISODate(), "updatedAt": ISODate() },
  
  { "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"), "entitlement_key": "support.level", "value": "email", "createdAt": ISODate(), "updatedAt": ISODate() }
]

// BUSINESS PLAN - Similar structure with "unlimited" limits and more features
// ENTERPRISE PLAN - Similar structure with custom deals
```

**How to Insert:** MongoDB Compass → Insert Documents (Bulk Insert)

---

### **Empty Collections (Auto-Created)**

These will be created automatically when first document is inserted:

- `users` - User accounts
- `entitlementcaches` - Generated snapshots
- `userentitlementoverrides` - Custom user overrides
- `conversations` - Chat history (if needed)

---

## 2️⃣ USER REGISTRATION FLOW

### **Frontend → Backend → Database**

#### **Step 1: User Opens App**

**Frontend (Desktop App):**
```typescript
// User sees registration form
<RegistrationForm>
  <Input name="Name" />
  <Input email="Email" />
  <Input password="Password" type="password" />
  <Button>Sign Up</Button>
</RegistrationForm>
```

---

#### **Step 2: User Submits Form**

**Frontend API Call:**
```typescript
POST http://localhost:3000/api/auth/register

Headers:
  Content-Type: application/json

Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass@123"
}
```

---

#### **Step 3: Backend Processing**

**File:** `src/controllers/users.controller.ts` → `registerUser()`

**Process:**
1. Validate input (email format, password strength)
2. Check if email already exists
3. Hash password using bcrypt
4. Get Free plan ID from database
5. Create user document

**Database Query 1: Check Email**
```javascript
db.users.findOne({ email: "john@example.com" })
// Returns: null (no existing user)
```

**Database Query 2: Get Free Plan**
```javascript
db.subscriptionplans.findOne({ name: "free" })
// Returns: { _id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"), name: "free", ... }
```

**Database Insert: Create User**
```javascript
db.users.insertOne({
  "_id": ObjectId("65c1234567890abcdef12345"),
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2b$10$hashedPasswordHere...",
  "role": "user",
  "status": "active",
  "lastSeen": null,
  "tags": [],
  "avatar": null,
  "preferences": {},
  
  // Subscription fields (default to Free plan)
  "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"),
  "subscription_status": "trial",
  "subscription_ends_at": null,
  "grace_period_until": null,
  "stripeCustomerId": null,
  "stripeSubscriptionId": null,
  
  // Entitlement cache
  "last_entitlement_sync": null,
  
  // Onboarding
  "onboardingPhase": "account_created",
  "phaseCompletedAt": {},
  "lastActivePhase": null,
  
  "createdAt": ISODate("2026-01-28T10:30:00Z"),
  "updatedAt": ISODate("2026-01-28T10:30:00Z")
})
```

---

#### **Step 4: Backend Response**

**Response to Frontend:**
```json
{
  "data": {
    "user": {
      "id": "65c1234567890abcdef12345",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "status": "active",
      "onboardingPhase": "account_created"
    },
    "message": "User registered successfully"
  }
}
```

---

#### **Step 5: Frontend Updates**

**Frontend Action:**
```typescript
// Store user ID locally (optional)
localStorage.setItem('userId', response.data.user.id);

// Redirect to login or auto-login
router.push('/login');
```

---

## 3️⃣ USER LOGIN FLOW

### **Frontend → Backend → Database**

#### **Step 1: User Submits Login**

**Frontend API Call:**
```typescript
POST http://localhost:3000/api/auth/login

Headers:
  Content-Type: application/json

Body:
{
  "email": "john@example.com",
  "password": "SecurePass@123"
}
```

---

#### **Step 2: Backend Processing**

**File:** `src/controllers/users.controller.ts` → `loginUser()`

**Process:**
1. Find user by email
2. Verify password
3. Check user status (active/disabled)
4. Update last seen
5. **Generate entitlement snapshot** ← KEY STEP
6. Generate JWT tokens

**Database Query 1: Find User**
```javascript
db.users.findOne({ email: "john@example.com" })
  .select('+password') // Include password for verification
// Returns: Full user document with password
```

**Database Update: Last Seen**
```javascript
db.users.updateOne(
  { _id: ObjectId("65c1234567890abcdef12345") },
  { $set: { lastSeen: ISODate("2026-01-28T10:35:00Z") } }
)
```

---

#### **Step 3: Entitlement Snapshot Generation**

**Service:** `src/services/entitlements.service.ts` → `resolveUserEntitlements()`

**Database Query 2: Get Plan Details**
```javascript
db.users.findById("65c1234567890abcdef12345")
  .populate('plan_id')
// Returns: User with populated plan object
```

**Database Query 3: Get All Entitlement Definitions**
```javascript
db.entitlementdefinitions.find({})
// Returns: Array of 18+ entitlement definitions
```

**Database Query 4: Get Plan's Entitlements**
```javascript
db.planentitlements.find({
  plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j0")
})
// Returns: 19 entitlement mappings for Free plan
```

**Database Query 5: Get User Overrides**
```javascript
db.userentitlementoverrides.find({
  user_id: ObjectId("65c1234567890abcdef12345"),
  $or: [
    { expires_at: { $exists: false } },
    { expires_at: { $gt: ISODate("2026-01-28T10:35:00Z") } }
  ]
})
// Returns: [] (no overrides for new user)
```

**Processing:**
```javascript
// Merge logic:
// 1. Start with plan entitlements
// 2. Override with user-specific entitlements
// 3. Group into 5 buckets (capabilities, limits, resources, deployment, support)
// 4. Calculate TTL (Free plan = 12 hours)
// 5. Generate HMAC signature

const snapshot = {
  capabilities: {
    "features.compare_mode": false,
    "features.file_upload": true,
    "features.prompt_manager": true,
    // ...
  },
  limits: {
    "limits.file_uploads_per_day": 5,
    "limits.file_size_mb": 10,
    // ...
  },
  resources: {
    "models.local.allowed": ["llama3"],
    "models.api.allowed": ["openai"],
    // ...
  },
  deployment: {
    "deployment.mode": "hybrid",
    "deployment.offline_cache_ttl_hours": 12,
    // ...
  },
  support: {
    "support.level": "community"
  }
}

const validUntil = new Date();
validUntil.setHours(validUntil.getHours() + 12); // 12 hours from now

const signature = crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(JSON.stringify(snapshot))
  .digest('hex');
```

**Database Insert: Cache Snapshot**
```javascript
db.entitlementcaches.insertOne({
  "_id": ObjectId(),
  "user_id": ObjectId("65c1234567890abcdef12345"),
  "plan_id": ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"),
  "snapshot": {
    capabilities: { ... },
    limits: { ... },
    resources: { ... },
    deployment: { ... },
    support: { ... }
  },
  "signature": "abc123def456...",
  "issued_at": ISODate("2026-01-28T10:35:00Z"),
  "valid_until": ISODate("2026-01-28T22:35:00Z"), // 12 hours later
  "client_synced": false,
  "revoked": false,
  "createdAt": ISODate("2026-01-28T10:35:00Z")
})
```

**Database Update: User Sync Time**
```javascript
db.users.updateOne(
  { _id: ObjectId("65c1234567890abcdef12345") },
  { $set: { last_entitlement_sync: ISODate("2026-01-28T10:35:00Z") } }
)
```

---

#### **Step 4: Backend Response**

**Response to Frontend:**
```json
{
  "data": {
    "user": {
      "id": "65c1234567890abcdef12345",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "status": "active",
      "lastSeen": "2026-01-28T10:35:00Z",
      "preferences": {},
      "tags": [],
      "onboardingPhase": "account_created",
      "createdAt": "2026-01-28T10:30:00Z"
    },
    "subscription": {
      "status": "trial",
      "nextBillingDate": null,
      "trialEndsAt": null,
      "stripeSubscriptionId": null,
      "plan": null
    },
    "authentication": {
      "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2026-02-27T10:35:00Z",
      "sessionDuration": "30 days",
      "message": "Use sessionToken for offline app authentication"
    },
    "entitlements": {
      "capabilities": {
        "features.compare_mode": false,
        "features.client_mode": false,
        "features.file_upload": true,
        "features.prompt_manager": true,
        "features.web_search": true
      },
      "limits": {
        "limits.file_uploads_per_day": 5,
        "limits.file_size_mb": 10,
        "limits.prompts_saved": 5,
        "limits.models_local": 1,
        "limits.models_api": 1,
        "limits.users_max": 1
      },
      "resources": {
        "models.local.allowed": ["llama3"],
        "models.api.allowed": ["openai"],
        "web.search.providers": ["duckduckgo"],
        "file.types.allowed": ["pdf", "txt", "docx"]
      },
      "deployment": {
        "deployment.mode": "hybrid",
        "deployment.offline_cache_ttl_hours": 12,
        "deployment.client_hosting_enabled": false
      },
      "support": {
        "support.level": "community"
      },
      "issued_at": "2026-01-28T10:35:00Z",
      "valid_until": "2026-01-28T22:35:00Z",
      "offline_allowed": true,
      "signature": "abc123def456..."
    }
  }
}
```

---

#### **Step 5: Frontend Storage**

**Frontend Action:**
```typescript
// Store tokens
localStorage.setItem('sessionToken', response.data.authentication.sessionToken);
localStorage.setItem('refreshToken', response.data.authentication.refreshToken);

// Store entitlements (for offline enforcement)
localStorage.setItem('entitlements', JSON.stringify(response.data.entitlements));

// Store user info
localStorage.setItem('user', JSON.stringify(response.data.user));

// Redirect to dashboard
router.push('/dashboard');
```

---

## 4️⃣ PLAN SELECTION & PAYMENT FLOW

### **Frontend → Backend → Stripe → Database**

#### **Step 1: User Views Plans**

**Frontend API Call:**
```typescript
GET http://localhost:3000/api/subscriptions

Headers:
  Authorization: Bearer <sessionToken>
```

**Backend Processing:**

**Database Query: Get All Active Plans**
```javascript
db.subscriptionplans.find({ status: "active" })
  .sort({ sort_order: 1 })
// Returns: 4 plans (Free, Pro, Business, Enterprise)
```

**Response:**
```json
{
  "data": [
    {
      "id": "65b8f1a2c3d4e5f6g7h8i9j0",
      "name": "free",
      "display_name": "Free Plan",
      "price_monthly": 0,
      "currency": "AUD"
    },
    {
      "id": "65b8f1a2c3d4e5f6g7h8i9j1",
      "name": "pro",
      "display_name": "Pro Plan",
      "price_monthly": 19.99,
      "price_yearly": 199,
      "currency": "AUD"
    },
    // ...
  ]
}
```

---

#### **Step 2: User Selects Pro Plan**

**Frontend API Call:**
```typescript
POST http://localhost:3000/api/payments/create-checkout-session

Headers:
  Authorization: Bearer <sessionToken>
  Content-Type: application/json

Body:
{
  "plan_id": "65b8f1a2c3d4e5f6g7h8i9j1",
  "billing_period": "monthly"
}
```

---

#### **Step 3: Backend Creates Stripe Session**

**File:** `src/controllers/payments.controller.ts` → `createCheckoutSession()`

**Database Query: Get Plan**
```javascript
db.subscriptionplans.findById("65b8f1a2c3d4e5f6g7h8i9j1")
// Returns: Pro plan details
```

**Database Query: Get User**
```javascript
db.users.findById("65c1234567890abcdef12345")
// Returns: User details
```

**Stripe API Call:**
```javascript
stripe.checkout.sessions.create({
  customer_email: "john@example.com",
  line_items: [{
    price: "price_ProMonthly",
    quantity: 1
  }],
  mode: 'subscription',
  success_url: 'app://payment-success',
  cancel_url: 'app://payment-cancel',
  metadata: {
    user_id: "65c1234567890abcdef12345",
    plan_id: "65b8f1a2c3d4e5f6g7h8i9j1"
  }
})
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_xyz123..."
}
```

---

#### **Step 4: User Completes Payment on Stripe**

**Frontend Action:**
```typescript
// Open Stripe checkout in browser/webview
window.open(response.checkout_url);
```

**User:** Enters card details → Stripe processes payment

---

#### **Step 5: Stripe Webhook Notification**

**Stripe → Backend:**
```typescript
POST http://localhost:3000/webhook/stripe

Headers:
  Stripe-Signature: t=123456789,v1=abc...

Body:
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_xyz123",
      "customer": "cus_abc123",
      "subscription": "sub_xyz789",
      "metadata": {
        "user_id": "65c1234567890abcdef12345",
        "plan_id": "65b8f1a2c3d4e5f6g7h8i9j1"
      }
    }
  }
}
```

**Backend Processing:**

**Database Update: User Subscription**
```javascript
db.users.updateOne(
  { _id: ObjectId("65c1234567890abcdef12345") },
  {
    $set: {
      plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"),
      subscription_status: "active",
      stripe_customer_id: "cus_abc123",
      stripe_subscription_id: "sub_xyz789",
      subscription_ends_at: ISODate("2026-02-28T00:00:00Z")
    }
  }
)
```

**Database Delete: Invalidate Old Entitlement Cache**
```javascript
db.entitlementcaches.deleteMany({
  user_id: ObjectId("65c1234567890abcdef12345")
})
```

---

#### **Step 6: User Returns to App**

**Frontend Action:**
```typescript
// App detects return from Stripe
if (window.location.href.includes('payment-success')) {
  // Sync entitlements to get Pro plan features
  syncEntitlements();
}
```

---

## 5️⃣ ENTITLEMENT SYNC FLOW

### **Frontend → Backend → Database**

#### **Step 1: Frontend Requests Sync**

**Frontend API Call:**
```typescript
POST http://localhost:3000/api/entitlements/sync

Headers:
  Authorization: Bearer <sessionToken>
  Content-Type: application/json

Body:
{
  "last_sync": "2026-01-28T10:35:00Z",
  "current_signature": "abc123def456..."
}
```

---

#### **Step 2: Backend Processing**

**File:** `src/controllers/entitlements.controller.ts` → `syncEntitlements()`

**Process:**
1. Verify session token (extract user ID)
2. Revoke old cache
3. Generate fresh snapshot (same process as login)

**Database Delete: Revoke Old Cache**
```javascript
db.entitlementcaches.updateMany(
  { user_id: ObjectId("65c1234567890abcdef12345") },
  { $set: { revoked: true } }
)
```

**Database Queries: Generate New Snapshot**
```javascript
// Same queries as login flow:
// 1. Get user with plan
// 2. Get entitlement definitions
// 3. Get plan entitlements (now Pro plan!)
// 4. Get user overrides
// 5. Merge and generate snapshot
```

**Database Query: Pro Plan Entitlements**
```javascript
db.planentitlements.find({
  plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j1")
})
// Returns: 19 entitlement mappings for PRO plan
```

**New Snapshot:**
```javascript
{
  capabilities: {
    "features.compare_mode": true,  // ← Changed!
    "features.file_upload": true,
    // ...
  },
  limits: {
    "limits.file_uploads_per_day": "unlimited",  // ← Changed!
    "limits.file_size_mb": 30,  // ← Changed!
    "limits.prompts_saved": 100,  // ← Changed!
    "limits.models_local": 5,  // ← Changed!
    "limits.models_api": 5,  // ← Changed!
  },
  resources: {
    "models.local.allowed": ["llama3", "mistral", "phi"],  // ← More models!
    "models.api.allowed": ["openai", "anthropic", "google"],  // ← More models!
  },
  deployment: {
    "deployment.offline_cache_ttl_hours": 48  // ← Extended!
  }
}
```

**Database Insert: New Cache**
```javascript
db.entitlementcaches.insertOne({
  user_id: ObjectId("65c1234567890abcdef12345"),
  plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j1"),
  snapshot: { /* Pro plan entitlements */ },
  signature: "xyz789new...",
  issued_at: ISODate("2026-01-28T11:00:00Z"),
  valid_until: ISODate("2026-01-30T11:00:00Z"),  // 48 hours for Pro
  revoked: false
})
```

---

#### **Step 3: Backend Response**

**Response:**
```json
{
  "message": "Entitlements synced successfully",
  "data": {
    "user_id": "65c1234567890abcdef12345",
    "plan_id": "65b8f1a2c3d4e5f6g7h8i9j1",
    "plan_name": "pro",
    "entitlements": {
      "capabilities": {
        "features.compare_mode": true,
        // ...
      },
      "limits": {
        "limits.file_uploads_per_day": "unlimited",
        // ...
      }
    },
    "issued_at": "2026-01-28T11:00:00Z",
    "valid_until": "2026-01-30T11:00:00Z",
    "offline_allowed": true,
    "signature": "xyz789new..."
  }
}
```

---

#### **Step 4: Frontend Updates**

**Frontend Action:**
```typescript
// Update local storage
localStorage.setItem('entitlements', JSON.stringify(response.data));

// Trigger UI update
window.dispatchEvent(new Event('entitlementsUpdated'));

// Show notification
toast.success('Upgraded to Pro Plan! compare mode unlocked.');

// Enable compare button
document.getElementById('compare-btn').disabled = false;
```

---

## 6️⃣ FEATURE ACCESS FLOW (compare MODE)

### **Frontend → Backend → Database**

#### **Step 1: User Clicks compare Mode**

**Frontend Check (Local Enforcement):**
```typescript
function canUsecompareMode() {
  const entitlements = JSON.parse(localStorage.getItem('entitlements'));
  
  // Check if cache expired
  const validUntil = new Date(entitlements.valid_until);
  if (new Date() > validUntil) {
    alert('Please sync your account');
    return false;
  }
  
  // Check capability
  if (!entitlements.capabilities['features.compare_mode']) {
    showUpgradeModal('compare mode is only available in Pro plan');
    return false;
  }
  
  return true;
}

if (canUsecompareMode()) {
  opencompareMode();
}
```

---

#### **Step 2: User Sends compare Request**

**Frontend API Call:**
```typescript
POST http://localhost:3000/api/chat/compare

Headers:
  Authorization: Bearer <sessionToken>
  Content-Type: application/json

Body:
{
  "requestId": "req_123",
  "mode": "compare",
  "messages": [
    {
      "role": "user",
      "content": "What is quantum computing?"
    }
  ],
  "models": [
    {
      "model": "gpt-4",
      "provider": "openai",
      "apiKey": "sk-..."
    },
    {
      "model": "claude-3",
      "provider": "anthropic",
      "apiKey": "sk-ant-..."
    }
  ]
}
```

---

#### **Step 3: Backend Middleware Check**

**File:** `src/routes/chat.routes.ts`

**Middleware:**
```typescript
router.post(
  '/compare',
  authenticateToken,  // 1. Verify JWT
  requireCapability('features.compare_mode'),  // 2. Check entitlement
  handleCompareRequest  // 3. Process request
);
```

**Middleware:** `src/middleware/entitlements.ts` → `requireCapability()`

**Database Query: Get Cached Entitlements**
```javascript
db.entitlementcaches.findOne({
  user_id: ObjectId("65c1234567890abcdef12345"),
  revoked: false,
  valid_until: { $gt: ISODate("2026-01-28T11:05:00Z") }
})
  .sort({ issued_at: -1 })
// Returns: Latest valid snapshot
```

**Check:**
```javascript
if (!snapshot.entitlements.capabilities['features.compare_mode']) {
  throw new AppError(
    'This feature requires the \'features.compare_mode\' capability. Please upgrade your plan.',
    403,
    'CAPABILITY_REQUIRED'
  );
}
// ✅ User has Pro plan → Check passes
```

---

#### **Step 4: Process compare Request**

**Controller:** `src/controllers/chat.controller.ts` → `handleCompareRequest()`

**Processing:** Send prompts to both models in parallel, stream responses

**Response (SSE Stream):**
```
event: model_response
data: {"model":"gpt-4","content":"Quantum computing..."}

event: model_response
data: {"model":"claude-3","content":"Quantum computing..."}

event: compare_complete
data: {"requestId":"req_123","success":true}
```

---

## 7️⃣ FILE UPLOAD FLOW

### **Frontend → Backend → Database**

#### **Step 1: User Selects File**

**Frontend Check:**
```typescript
function canUploadFile(file) {
  const entitlements = JSON.parse(localStorage.getItem('entitlements'));
  
  // Check file size
  const maxSize = entitlements.limits['limits.file_size_mb'];
  if (maxSize !== 'unlimited' && file.size > maxSize * 1024 * 1024) {
    alert(`File too large. Max: ${maxSize}MB`);
    return false;
  }
  
  // Check daily limit (need to track usage)
  const dailyLimit = entitlements.limits['limits.file_uploads_per_day'];
  // ... (implementation depends on usage tracking)
  
  return true;
}
```

---

#### **Step 2: Upload File**

**Frontend API Call:**
```typescript
POST http://localhost:3000/api/files/upload

Headers:
  Authorization: Bearer <sessionToken>
  Content-Type: multipart/form-data

Body:
FormData {
  file: <binary data>
}
```

---

#### **Step 3: Backend Validation**

**Middleware:** `src/middleware/entitlements.ts` → `checkFileUpload()`

**Database Query: Get Entitlements**
```javascript
db.entitlementcaches.findOne({
  user_id: ObjectId("65c1234567890abcdef12345"),
  revoked: false,
  valid_until: { $gt: ISODate() }
})
```

**Checks:**
```javascript
// 1. File upload enabled?
if (!entitlements.capabilities['features.file_upload']) {
  throw new Error('File upload disabled');
}

// 2. File size within limit?
const maxSize = entitlements.limits['limits.file_size_mb'];
if (maxSize !== 'unlimited' && fileSize > maxSize) {
  throw new Error(`Max file size: ${maxSize}MB`);
}

// 3. Daily limit reached?
const dailyLimit = entitlements.limits['limits.file_uploads_per_day'];
if (dailyLimit !== 'unlimited') {
  // Count today's uploads
  const count = await db.files.countDocuments({
    user_id: userId,
    uploaded_at: { $gte: startOfToday }
  });
  
  if (count >= dailyLimit) {
    throw new Error('Daily upload limit reached');
  }
}
```

**Database Insert: Store File**
```javascript
db.files.insertOne({
  user_id: ObjectId("65c1234567890abcdef12345"),
  filename: "document.pdf",
  size: 2048576,
  uploaded_at: ISODate(),
  // ... other file metadata
})
```

---

## 8️⃣ PLAN UPGRADE FLOW

### **Pro → Business Upgrade**

#### **Step 1: User Selects Business Plan**

**Frontend API Call:**
```typescript
POST http://localhost:3000/api/subscriptions/upgrade

Headers:
  Authorization: Bearer <sessionToken>

Body:
{
  "new_plan_id": "65b8f1a2c3d4e5f6g7h8i9j2",
  "billing_period": "monthly"
}
```

---

#### **Step 2: Backend Updates Stripe**

**Stripe API Call:**
```javascript
stripe.subscriptions.update("sub_xyz789", {
  items: [{
    id: "si_xyz",
    price: "price_BusinessMonthly"
  }]
})
```

---

#### **Step 3: Stripe Webhook**

**Event:** `customer.subscription.updated`

**Database Update: User Plan**
```javascript
db.users.updateOne(
  { stripe_subscription_id: "sub_xyz789" },
  {
    $set: {
      plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j2"),
      subscription_ends_at: ISODate("2026-02-28T00:00:00Z")
    }
  }
)
```

**Database Delete: Invalidate Cache**
```javascript
db.entitlementcaches.updateMany(
  { user_id: ObjectId("65c1234567890abcdef12345") },
  { $set: { revoked: true } }
)
```

---

#### **Step 4: User Syncs**

**Frontend:** Calls `/api/entitlements/sync` (same as before)

**Database Query: Business Plan Entitlements**
```javascript
db.planentitlements.find({
  plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j2")
})
// Returns: Business plan entitlements with client_mode enabled
```

**New Snapshot:**
```javascript
{
  capabilities: {
    "features.compare_mode": true,
    "features.client_mode": true,  // ← NEW!
    // ...
  },
  limits: {
    "limits.file_uploads_per_day": "unlimited",
    "limits.file_size_mb": "unlimited",  // ← No limit!
    "limits.users_max": 3,  // ← Multi-user!
  },
  deployment: {
    "deployment.offline_cache_ttl_hours": 72  // ← Extended!
  }
}
```

---

## 9️⃣ OFFLINE USAGE FLOW

### **User Goes Offline**

#### **Step 1: App Checks Cache**

**Frontend:**
```typescript
function checkOfflineAccess() {
  const entitlements = JSON.parse(localStorage.getItem('entitlements'));
  const validUntil = new Date(entitlements.valid_until);
  const now = new Date();
  
  if (now > validUntil) {
    // Cache expired
    if (navigator.onLine) {
      // Online → Sync
      syncEntitlements();
    } else {
      // Offline → Degrade
      showNotification('Please connect to sync your account');
      disablePremiumFeatures();
    }
  } else {
    // Cache valid → Continue
    console.log('Offline access valid until', validUntil);
  }
}
```

---

#### **Step 2: User Works Offline (48 Hours for Pro)**

**Frontend:** Uses cached entitlements for local enforcement

**Example:**
```typescript
// User tries to upload file offline
if (canUploadFile(file)) {
  // Store in IndexedDB for sync later
  await offlineQueue.add({
    type: 'file_upload',
    file: file,
    timestamp: Date.now()
  });
  
  toast.success('File queued for upload');
}
```

---

#### **Step 3: Cache Expires (After 48 Hours)**

**Frontend:**
```typescript
// App startup check
if (isCacheExpired()) {
  if (navigator.onLine) {
    await syncEntitlements();
  } else {
    // Block features
    disableApp();
    showModal('Connect to internet to sync your subscription');
  }
}
```

---

#### **Step 4: User Comes Online**

**Frontend:**
```typescript
window.addEventListener('online', async () => {
  if (isCacheExpired()) {
    const newSnapshot = await syncEntitlements();
    
    // Process offline queue
    await offlineQueue.sync();
    
    toast.success('Account synced successfully');
  }
});
```

---

## 🔟 COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         INITIAL SETUP                           │
│                         (One-Time)                              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────┐
        │  Admin Creates Database Collections:     │
        │  1. subscriptionplans (4 plans)          │
        │  2. entitlementdefinitions (18 defs)     │
        │  3. planentitlements (76 mappings)       │
        └──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      USER REGISTRATION                          │
└─────────────────────────────────────────────────────────────────┘
                               │
    Frontend (Desktop App)     │     Backend (Node.js)
                               │
    User fills form  ───────────────────────────────────►
    (name, email, pwd)         │
                               │   POST /api/auth/register
                               │                     │
                               │                     ▼
                               │           1. Validate input
                               │           2. Hash password
                               │           3. Get Free plan ID
                               │                     │
                               │           ┌─────────▼────────┐
                               │           │  DB: users.insert │
                               │           │  - plan_id: Free  │
                               │           │  - status: trial  │
                               │           └──────────────────┘
                               │                     │
    ◄───────────────────────────────────────────────┘
    Response: User created     │
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         USER LOGIN                              │
└─────────────────────────────────────────────────────────────────┘
                               │
    User enters credentials ───────────────────────────────►
                               │   POST /api/auth/login
                               │                     │
                               │                     ▼
                               │           1. Find user
                               │           2. Verify password
                               │           3. Update last_seen
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ Entitlement Service  │
                               │           │ (Generate Snapshot)  │
                               │           └──────────────────────┘
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │  DB Queries:         │
                               │           │  1. Get user's plan  │
                               │           │  2. Get definitions  │
                               │           │  3. Get plan ents    │
                               │           │  4. Get overrides    │
                               │           └──────────────────────┘
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │  Merge Logic:        │
                               │           │  - Group into 5      │
                               │           │  - Calculate TTL     │
                               │           │  - Sign with HMAC    │
                               │           └──────────────────────┘
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ DB: caches.insert    │
                               │           │ - snapshot           │
                               │           │ - valid_until (12h)  │
                               │           │ - signature          │
                               │           └──────────────────────┘
                               │                     │
    ◄───────────────────────────────────────────────┘
    Response:                  │
    - sessionToken (JWT 30d)   │
    - entitlements snapshot    │
                               │
    Store in localStorage ────►│
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FEATURE ACCESS (compare)                        │
└─────────────────────────────────────────────────────────────────┘
                               │
    User clicks compare ─────────────────────────────────►
                               │   POST /api/chat/compare
                               │                     │
    Local check first:         │                     ▼
    - Cache expired?           │           Middleware:
    - Has capability?          │           authenticateToken()
                               │                     │
                               │                     ▼
                               │           requireCapability()
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ DB: caches.findOne   │
                               │           │ - user_id            │
                               │           │ - valid_until > now  │
                               │           │ - revoked: false     │
                               │           └──────────────────────┘
                               │                     │
                               │                     ▼
                               │           Check:
                               │           features.compare_mode?
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │  Free: BLOCKED 403   │
                               │           │  Pro: ALLOWED ✅     │
                               │           └──────────────────────┘
                               │                     │
    ◄───────────────────────────────────────────────┘
    SSE Stream: Model responses│
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PLAN UPGRADE                               │
└─────────────────────────────────────────────────────────────────┘
                               │
    User clicks Upgrade ───────────────────────────────►
                               │   POST /api/payments/checkout
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ DB: plans.findById   │
                               │           └──────────────────────┘
                               │                     │
                               │                     ▼
                               │           Stripe.checkout.create()
                               │                     │
    ◄───────────────────────────────────────────────┘
    Response: checkout_url     │
                               │
    Open Stripe payment ───────►  Stripe Payment Portal
                               │
    [User pays] ───────────────►
                               │
                               │   Webhook: checkout.completed
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ DB: users.update     │
                               │           │ - plan_id: Pro       │
                               │           │ - status: active     │
                               │           │ - stripe_sub_id      │
                               │           └──────────────────────┘
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ DB: caches.delete    │
                               │           │ (invalidate old)     │
                               │           └──────────────────────┘
                               │
    Return to app ─────────────────────────────────────►
                               │   POST /api/entitlements/sync
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ Generate Pro snapshot│
                               │           │ - compare_mode: true   │
                               │           │ - TTL: 48h           │
                               │           └──────────────────────┘
                               │                     │
    ◄───────────────────────────────────────────────┘
    New entitlements           │
                               │
    Update localStorage ───────►│
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE USAGE                                │
└─────────────────────────────────────────────────────────────────┘
                               │
    App checks cache ──────────►│  Local Check:
                               │  - valid_until > now?
                               │                     │
                               │           ┌─────────▼────────────┐
                               │           │ Day 1: Valid ✅      │
                               │           │ Day 2: Valid ✅      │
                               │           │ Day 3: Expired ❌    │
                               │           └──────────────────────┘
                               │                     │
                               │                     ▼
    If expired + offline ──────►│  Block features
                               │  Show: "Connect to sync"
                               │
    If expired + online ───────────────────────────────►
                               │   POST /api/entitlements/sync
                               │                     │
    ◄───────────────────────────────────────────────┘
    Fresh snapshot             │
                               │
                               ▼
                         [Cycle repeats]
```

---

## 📝 SUMMARY TABLE

| **Action** | **Frontend** | **Backend Endpoint** | **Database Collections Used** | **Collections Modified** |
|------------|--------------|----------------------|-------------------------------|--------------------------|
| **Registration** | Form submit | POST /api/auth/register | `subscriptionplans` (read) | `users` (insert) |
| **Login** | Credentials | POST /api/auth/login | `users`, `subscriptionplans`, `entitlementdefinitions`, `planentitlements`, `userentitlementoverrides` (read) | `users` (update last_seen), `entitlementcaches` (insert) |
| **View Plans** | Load pricing | GET /api/subscriptions | `subscriptionplans` (read) | None |
| **Upgrade Plan** | Payment flow | POST /api/payments/checkout | `subscriptionplans`, `users` (read) | None (Stripe handles) |
| **Stripe Webhook** | Auto (background) | POST /webhook/stripe | `users` (read) | `users` (update plan), `entitlementcaches` (delete) |
| **Sync Entitlements** | Manual/auto sync | POST /api/entitlements/sync | `users`, `entitlementdefinitions`, `planentitlements`, `userentitlementoverrides` (read) | `entitlementcaches` (revoke old, insert new) |
| **compare Mode** | Feature click | POST /api/chat/compare | `entitlementcaches` (read) | None |
| **File Upload** | File select | POST /api/files/upload | `entitlementcaches`, `files` (read) | `files` (insert) |
| **Offline Check** | App startup | None (local only) | None | None |

---

## 🎯 KEY TAKEAWAYS

### **One-Time Setup:**
- 4 documents in `subscriptionplans`
- 18 documents in `entitlementdefinitions`
- 76+ documents in `planentitlements`

### **Per User:**
- 1 document in `users` (created on registration)
- 1 document in `entitlementcaches` (refreshed on login/sync)
- 0-N documents in `userentitlementoverrides` (only for custom deals)

### **Data Flow Pattern:**
```
User Action → Frontend → Backend API → Database Query → 
Service Logic → Database Write → Response → Frontend Update → LocalStorage
```

### **Entitlement Resolution:**
```
Plan Entitlements + User Overrides → Merge → Group into 5 Buckets → 
Sign with HMAC → Cache (with TTL) → Return to Client → Local Enforcement
```

---

**END OF DOCUMENT** 🚀
