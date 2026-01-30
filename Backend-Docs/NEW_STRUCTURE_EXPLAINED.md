# 🔄 NEW DATA STRUCTURE & FLOW EXPLANATION

## पुराना vs नया Structure (Complete Comparison)

---

## ❌ OLD STRUCTURE (Previous Implementation)

### **Collections:**
1. **users** - Basic user info
2. **subscriptions** - Subscription details (userId, planId, status, billing dates)
3. **subscriptionplans** - Plan pricing + features array

### **Data Flow (OLD):**
```
User document
  └─ _id: "6979d8c3bd1847866b6e9765"

Subscription document (linked by userId)
  ├─ userId: "6979d8c3bd1847866b6e9765"
  ├─ planId: "6926f333c785804001319e82"
  ├─ status: "trial"
  └─ trialEndsAt: "2026-02-27"

SubscriptionPlan document (linked by planId)
  ├─ _id: "6926f333c785804001319e82"
  ├─ name: "Pro Plan"
  ├─ price: 499
  ├─ features: ["Unlimited AI Models", "50GB Storage", ...]  ← Monolithic!
  └─ stripePriceId: "price_..."
```

### **Problems with OLD:**
- Features embedded as string array in plan
- No fine-grained control (all-or-nothing)
- Hard to add new features without schema changes
- No user-specific overrides
- No offline caching mechanism
- Can't express limits (like "5 files per day")

---

## ✅ NEW STRUCTURE (Entitlement-Based)

### **Collections:**
1. **users** - User info + subscription status
2. **subscriptionplans** - ONLY pricing information
3. **entitlementdefinitions** - Master list of all entitlements
4. **planentitlements** - Maps plans to entitlements
5. **userentitlementoverrides** - Custom per-user overrides
6. **entitlementcaches** - Generated snapshots with signature

### **Data Flow (NEW):**

```
User document (users collection)
  ├─ _id: "6979d8c3bd1847866b6e9765"
  ├─ email: "mister@gmail.com"
  ├─ plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j0")  ← Direct plan reference
  ├─ subscription_status: "trial"
  ├─ subscription_ends_at: "2026-02-27"
  ├─ last_entitlement_sync: "2026-01-28T10:00:00Z"
  └─ stripeSubscriptionId: null

SubscriptionPlan document (subscriptionplans collection)
  ├─ _id: "65b8f1a2c3d4e5f6g7h8i9j0"
  ├─ name: "free"
  ├─ display_name: "Free Plan"
  ├─ slug: "free"
  ├─ price_monthly: 0
  ├─ price_yearly: 0
  ├─ currency: "AUD"
  └─ stripe_product_id: null
  ❌ NO features array!

EntitlementDefinition documents (entitlementdefinitions collection)
  ├─ { key: "features.arena_mode", type: "boolean", default_value: false }
  ├─ { key: "limits.file_uploads_per_day", type: "number", default_value: 5 }
  ├─ { key: "models.local.allowed", type: "array", default_value: ["llama3"] }
  └─ ... 15 more definitions

PlanEntitlement documents (planentitlements collection)
  Free Plan Mappings:
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "features.arena_mode", value: false }
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "limits.file_uploads_per_day", value: 5 }
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "limits.file_size_mb", value: 10 }
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "models.local.allowed", value: ["llama3"] }
  └─ ... 14 more for Free plan

  Pro Plan Mappings:
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "features.arena_mode", value: true }
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "limits.file_uploads_per_day", value: "unlimited" }
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "limits.file_size_mb", value: 30 }
  ├─ { plan_id: "65b8f1a2...", entitlement_key: "models.local.allowed", value: ["llama3", "mistral", "phi"] }
  └─ ... 14 more for Pro plan

UserEntitlementOverride documents (userentitlementoverrides collection)
  ├─ { user_id: "6979d8c3...", entitlement_key: "limits.models_local", value: 10, reason: "Beta tester", expires_at: "2026-03-01" }
  └─ Optional - only for custom deals

EntitlementCache document (entitlementcaches collection)
  ├─ user_id: "6979d8c3bd1847866b6e9765"
  ├─ plan_id: "65b8f1a2c3d4e5f6g7h8i9j0"
  ├─ snapshot: {
  │    capabilities: { ... },
  │    limits: { ... },
  │    resources: { ... },
  │    deployment: { ... },
  │    support: { ... }
  │  }
  ├─ signature: "abc123def456..."  ← HMAC to prevent tampering
  ├─ issued_at: "2026-01-28T10:00:00Z"
  ├─ valid_until: "2026-01-28T22:00:00Z"  ← TTL based on plan
  └─ revoked: false
```

---

## 🔍 COMPLETE LOGIN FLOW (Step-by-Step)

### **Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "mister@gmail.com",
  "password": "SecurePass@123"
}
```

---

### **Backend Processing:**

#### **Step 1: Find User**
```javascript
const user = await User.findOne({ email: "mister@gmail.com" });
```
**Result:**
```javascript
{
  _id: ObjectId("6979d8c3bd1847866b6e9765"),
  email: "mister@gmail.com",
  plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j0"),  // Free plan
  subscription_status: "trial",
  subscription_ends_at: "2026-02-27T09:37:07Z",
  last_entitlement_sync: null
}
```

---

#### **Step 2: Verify Password**
```javascript
const isValid = await user.comparePassword(password);
// ✅ Valid
```

---

#### **Step 3: Generate Entitlement Snapshot**
```javascript
const snapshot = await entitlementsService.resolveUserEntitlements(user._id);
```

**Inside `resolveUserEntitlements()`:**

##### **3a: Get Plan Details**
```javascript
const userWithPlan = await User.findById(user._id).populate('plan_id');
```
**Result:**
```javascript
{
  _id: "6979d8c3...",
  plan_id: {
    _id: "65b8f1a2...",
    name: "free",
    display_name: "Free Plan",
    price_monthly: 0
  }
}
```

##### **3b: Get All Entitlement Definitions**
```javascript
const definitions = await EntitlementDefinition.find({});
```
**Result:** 18 definitions (master list)

##### **3c: Get Plan's Entitlements**
```javascript
const planEntitlements = await PlanEntitlement.find({
  plan_id: ObjectId("65b8f1a2c3d4e5f6g7h8i9j0")
});
```
**Result:**
```javascript
[
  { entitlement_key: "features.arena_mode", value: false },
  { entitlement_key: "features.file_upload", value: true },
  { entitlement_key: "features.prompt_manager", value: true },
  { entitlement_key: "features.web_search", value: true },
  { entitlement_key: "features.client_mode", value: false },
  
  { entitlement_key: "limits.file_uploads_per_day", value: 5 },
  { entitlement_key: "limits.file_size_mb", value: 10 },
  { entitlement_key: "limits.prompts_saved", value: 5 },
  { entitlement_key: "limits.models_local", value: 1 },
  { entitlement_key: "limits.models_api", value: 1 },
  { entitlement_key: "limits.users_max", value: 1 },
  
  { entitlement_key: "models.local.allowed", value: ["llama3"] },
  { entitlement_key: "models.api.allowed", value: ["openai"] },
  { entitlement_key: "web.search.providers", value: ["duckduckgo"] },
  { entitlement_key: "file.types.allowed", value: ["pdf", "txt", "docx"] },
  
  { entitlement_key: "deployment.mode", value: "hybrid" },
  { entitlement_key: "deployment.offline_cache_ttl_hours", value: 12 },
  { entitlement_key: "deployment.client_hosting_enabled", value: false },
  
  { entitlement_key: "support.level", value: "community" }
]
```

##### **3d: Get User Overrides (if any)**
```javascript
const overrides = await UserEntitlementOverride.find({
  user_id: user._id,
  $or: [
    { expires_at: { $exists: false } },
    { expires_at: { $gt: new Date() } }
  ]
});
```
**Result:** `[]` (no custom overrides for this user)

##### **3e: Merge Logic**
```javascript
// Start with plan entitlements
const merged = {};
planEntitlements.forEach(ent => {
  merged[ent.entitlement_key] = ent.value;
});

// Override with user-specific (if any)
overrides.forEach(ent => {
  merged[ent.entitlement_key] = ent.value;  // User override wins!
});
```

##### **3f: Group into 5 Buckets**
```javascript
const snapshot = {
  capabilities: {
    "features.arena_mode": false,
    "features.client_mode": false,
    "features.file_upload": true,
    "features.prompt_manager": true,
    "features.web_search": true
  },
  limits: {
    "limits.file_uploads_per_day": 5,
    "limits.file_size_mb": 10,
    "limits.prompts_saved": 5,
    "limits.models_local": 1,
    "limits.models_api": 1,
    "limits.users_max": 1
  },
  resources: {
    "models.local.allowed": ["llama3"],
    "models.api.allowed": ["openai"],
    "web.search.providers": ["duckduckgo"],
    "file.types.allowed": ["pdf", "txt", "docx"]
  },
  deployment: {
    "deployment.mode": "hybrid",
    "deployment.offline_cache_ttl_hours": 12,
    "deployment.client_hosting_enabled": false
  },
  support: {
    "support.level": "community"
  }
};
```

##### **3g: Calculate TTL**
```javascript
const ttl_hours = snapshot.deployment["deployment.offline_cache_ttl_hours"]; // 12 for Free
const valid_until = new Date();
valid_until.setHours(valid_until.getHours() + ttl_hours);
// valid_until = "2026-01-28T22:00:00Z" (12 hours from now)
```

##### **3h: Generate HMAC Signature**
```javascript
const signature = crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(JSON.stringify(snapshot))
  .digest('hex');
// signature = "abc123def456789..."
```

##### **3i: Cache Snapshot**
```javascript
await EntitlementCache.create({
  user_id: user._id,
  plan_id: user.plan_id,
  snapshot: snapshot,
  signature: signature,
  issued_at: new Date(),
  valid_until: valid_until,
  client_synced: false,
  revoked: false
});
```

##### **3j: Update User**
```javascript
await User.updateOne(
  { _id: user._id },
  { $set: { last_entitlement_sync: new Date() } }
);
```

---

#### **Step 4: Get Plan Details for Response**
```javascript
const plan = await SubscriptionPlan.findById(user.plan_id);
```
**Result:**
```javascript
{
  _id: "65b8f1a2c3d4e5f6g7h8i9j0",
  name: "free",
  display_name: "Free Plan",
  slug: "free",
  price_monthly: 0,
  price_yearly: 0,
  currency: "AUD"
}
```

---

#### **Step 5: Generate JWT Tokens**
```javascript
const sessionToken = jwt.sign(
  {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    subscriptionStatus: user.subscription_status,
    sessionType: 'trial'
  },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

const refreshToken = jwt.sign(
  {
    userId: user._id.toString(),
    type: 'refresh'
  },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '90d' }
);
```

---

### **Response to Client:**
```json
{
  "data": {
    "user": {
      "id": "6979d8c3bd1847866b6e9765",
      "name": "mrs",
      "email": "mister@gmail.com",
      "role": "user",
      "status": "active",
      "lastSeen": "2026-01-28T10:00:00Z",
      "tags": ["new-user"],
      "onboardingPhase": "account_created",
      "createdAt": "2026-01-28T09:37:07Z"
    },
    "subscription": {
      "status": "trial",
      "subscription_ends_at": "2026-02-27T09:37:07Z",
      "grace_period_until": null,
      "stripeSubscriptionId": null,
      "plan": {
        "id": "65b8f1a2c3d4e5f6g7h8i9j0",
        "name": "free",
        "display_name": "Free Plan",
        "slug": "free",
        "price_monthly": 0,
        "price_yearly": 0,
        "currency": "AUD",
        "is_contact_sales": false,
        "status": "active"
      }
    },
    "authentication": {
      "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2026-02-27T10:00:00Z",
      "sessionDuration": "30 days",
      "message": "Use sessionToken for offline app authentication"
    },
    "entitlements": {
      "capabilities": {
        "features.arena_mode": false,
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
      "issued_at": "2026-01-28T10:00:00Z",
      "valid_until": "2026-01-28T22:00:00Z",
      "offline_allowed": true,
      "signature": "abc123def456789..."
    }
  }
}
```

---

## 📊 DATABASE QUERIES SUMMARY

### **During Login:**
```
1. User.findOne({ email })                           → 1 query
2. User.findById(userId).populate('plan_id')        → 1 query
3. EntitlementDefinition.find({})                   → 1 query (cached)
4. PlanEntitlement.find({ plan_id })                → 1 query
5. UserEntitlementOverride.find({ user_id })        → 1 query
6. EntitlementCache.create({...})                   → 1 insert
7. User.updateOne({ last_entitlement_sync })        → 1 update

Total: 5 reads + 1 insert + 1 update = 7 operations
```

**Optimization:** EntitlementDefinitions can be cached in memory (they rarely change).

---

## 🔄 PLAN UPGRADE FLOW

### **When User Upgrades from Free → Pro:**

1. **Stripe webhook** receives `checkout.session.completed`
2. **Update User:**
   ```javascript
   await User.updateOne(
     { _id: userId },
     {
       $set: {
         plan_id: proPlanId,  // Change plan reference
         subscription_status: "active",
         subscription_ends_at: nextBillingDate,
         stripeSubscriptionId: "sub_xyz789"
       }
     }
   );
   ```

3. **Revoke Old Entitlement Cache:**
   ```javascript
   await EntitlementCache.updateMany(
     { user_id: userId },
     { $set: { revoked: true } }
   );
   ```

4. **User Syncs Next Time:**
   ```javascript
   // POST /api/entitlements/sync
   // New snapshot generated with Pro plan entitlements:
   {
     capabilities: {
       "features.arena_mode": true,  // ← Now enabled!
     },
     limits: {
       "limits.file_uploads_per_day": "unlimited",  // ← Upgraded!
       "limits.file_size_mb": 30,  // ← Increased!
     },
     resources: {
       "models.local.allowed": ["llama3", "mistral", "phi"],  // ← More models!
     },
     deployment: {
       "deployment.offline_cache_ttl_hours": 48  // ← Extended!
     }
   }
   ```

---

## 🎯 KEY ADVANTAGES

### **1. Granular Control**
```javascript
// Can express complex entitlements:
"limits.file_uploads_per_day": 5           // Free
"limits.file_uploads_per_day": "unlimited" // Pro
"limits.file_uploads_per_day": 100         // Business (custom)
```

### **2. User-Specific Overrides**
```javascript
// Give beta tester extra models:
{
  user_id: "6979d8c3...",
  entitlement_key: "limits.models_local",
  value: 10,  // Override from 1 to 10
  reason: "Beta tester",
  expires_at: "2026-03-01"
}
```

### **3. Offline Support**
```javascript
// Client caches snapshot locally
// Valid for 12-72 hours (based on plan)
// Signed with HMAC to prevent tampering
```

### **4. Easy to Add Features**
```javascript
// Add new feature:
1. Insert into EntitlementDefinition
2. Insert into PlanEntitlement for each plan
3. Middleware automatically checks it!

// No code changes needed!
```

---

## ✅ MIGRATION CHECKLIST

- [x] User model updated (plan_id, subscription_status fields)
- [x] Subscription model marked DEPRECATED
- [x] SubscriptionPlan model updated (new fields)
- [x] EntitlementDefinition model created
- [x] PlanEntitlement model created
- [x] UserEntitlementOverride model created
- [x] EntitlementCache model created
- [x] Entitlements service created
- [x] Admin endpoints for definitions
- [x] Seeder script for definitions
- [x] User controllers updated (no more Subscription queries)
- [ ] Seed entitlement definitions (run script)
- [ ] Create subscription plans (4 plans)
- [ ] Create plan entitlements (76+ mappings)
- [ ] Test complete flow

---

**Next Steps:** Run seeder scripts to populate database!
