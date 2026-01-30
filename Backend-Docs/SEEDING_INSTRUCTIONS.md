# 🚀 SEEDING INSTRUCTIONS

## Entitlement Definitions Setup

### Option 1: Run Seeder Script (Recommended)

**Command:**
```bash
npx ts-node scripts/seedEntitlementDefinitions.ts
```

**What it does:**
- Connects to your MongoDB database
- Inserts all 18 entitlement definitions
- Skips duplicates (safe to run multiple times)
- Shows detailed progress and summary

**Expected Output:**
```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB

📋 Starting Entitlement Definitions Seeding...
📊 Total definitions to seed: 18
📦 Existing definitions in database: 0

✅ Inserted: features.compare_mode
✅ Inserted: features.client_mode
✅ Inserted: features.file_upload
...

============================================================
📊 SEEDING SUMMARY
============================================================
✅ Successfully inserted: 18
⏭️  Skipped (duplicates): 0
❌ Errors: 0
📦 Total in database now: 18
============================================================

📑 BREAKDOWN BY CATEGORY:
  CAPABILITIES: 5 definitions
  LIMITS: 6 definitions
  RESOURCES: 4 definitions
  DEPLOYMENT: 3 definitions
  SUPPORT: 1 definitions

✨ Seeding completed successfully!
```

---

### Option 2: Use Postman API (If Some Missing)

**Base URL:** `http://localhost:3000`

#### Step 1: Login as Admin
```
POST /api/admin/auth/login

Body:
{
  "email": "admin@sovereignai.com",
  "password": "your_admin_password"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    ...
  }
}
```

**Copy the `accessToken` for next requests.**

---

#### Step 2: Create Entitlement Definition
```
POST /api/admin/entitlements/definitions

Headers:
  Authorization: Bearer <accessToken>
  Content-Type: application/json

Body:
{
  "key": "features.advanced_analytics",
  "type": "boolean",
  "category": "capabilities",
  "description": "Advanced analytics dashboard",
  "default_value": false,
  "validation_rules": null
}

Response:
{
  "success": true,
  "message": "Entitlement definition created successfully",
  "data": {
    "_id": "65c1234567890abcdef12345",
    "key": "features.advanced_analytics",
    "type": "boolean",
    "category": "capabilities",
    "description": "Advanced analytics dashboard",
    "default_value": false,
    "validation_rules": null,
    "createdAt": "2026-01-28T12:00:00.000Z",
    "updatedAt": "2026-01-28T12:00:00.000Z"
  }
}
```

---

#### Step 3: View All Definitions
```
GET /api/admin/entitlements/definitions

Headers:
  Authorization: Bearer <accessToken>

Response:
{
  "success": true,
  "data": {
    "total": 18,
    "definitions": [...],
    "grouped": {
      "capabilities": [...],
      "limits": [...],
      "resources": [...],
      "deployment": [...],
      "support": [...]
    }
  }
}
```

---

#### Step 4: Update Definition (Optional)
```
PUT /api/admin/entitlements/definitions/:id

Headers:
  Authorization: Bearer <accessToken>
  Content-Type: application/json

Body:
{
  "description": "Updated description",
  "default_value": true,
  "validation_rules": { "min": 0, "max": 100 }
}
```

---

#### Step 5: Delete Definition (Optional)
```
DELETE /api/admin/entitlements/definitions/:id

Headers:
  Authorization: Bearer <accessToken>

Response:
{
  "success": true,
  "message": "Entitlement definition deleted successfully",
  "data": {
    "key": "features.example"
  }
}
```

---

## 📋 Complete List of Definitions to Add

### CAPABILITIES (5)
```json
{ "key": "features.compare_mode", "type": "boolean", "category": "capabilities", "default_value": false }
{ "key": "features.client_mode", "type": "boolean", "category": "capabilities", "default_value": false }
{ "key": "features.file_upload", "type": "boolean", "category": "capabilities", "default_value": true }
{ "key": "features.prompt_manager", "type": "boolean", "category": "capabilities", "default_value": true }
{ "key": "features.web_search", "type": "boolean", "category": "capabilities", "default_value": true }
```

### LIMITS (6)
```json
{ "key": "limits.file_uploads_per_day", "type": "number", "category": "limits", "default_value": 5, "validation_rules": { "min": 0 } }
{ "key": "limits.file_size_mb", "type": "number", "category": "limits", "default_value": 10, "validation_rules": { "min": 1, "max": 100 } }
{ "key": "limits.prompts_saved", "type": "number", "category": "limits", "default_value": 5, "validation_rules": { "min": 1 } }
{ "key": "limits.models_local", "type": "number", "category": "limits", "default_value": 1, "validation_rules": { "min": 1 } }
{ "key": "limits.models_api", "type": "number", "category": "limits", "default_value": 1, "validation_rules": { "min": 1 } }
{ "key": "limits.users_max", "type": "number", "category": "limits", "default_value": 1, "validation_rules": { "min": 1 } }
```

### RESOURCES (4)
```json
{ "key": "models.local.allowed", "type": "array", "category": "resources", "default_value": ["llama3"] }
{ "key": "models.api.allowed", "type": "array", "category": "resources", "default_value": ["openai"] }
{ "key": "web.search.providers", "type": "array", "category": "resources", "default_value": ["duckduckgo"] }
{ "key": "file.types.allowed", "type": "array", "category": "resources", "default_value": ["pdf", "txt", "docx"] }
```

### DEPLOYMENT (3)
```json
{ "key": "deployment.mode", "type": "string", "category": "deployment", "default_value": "hybrid", "validation_rules": { "enum": ["cloud", "hybrid", "local"] } }
{ "key": "deployment.offline_cache_ttl_hours", "type": "number", "category": "deployment", "default_value": 12, "validation_rules": { "min": 1, "max": 720 } }
{ "key": "deployment.client_hosting_enabled", "type": "boolean", "category": "deployment", "default_value": false }
```

### SUPPORT (1)
```json
{ "key": "support.level", "type": "string", "category": "support", "default_value": "community", "validation_rules": { "enum": ["community", "email", "priority", "dedicated"] } }
```

---

## ✅ Verification

After seeding, verify with:
```
GET /api/admin/entitlements/definitions
```

You should see:
- Total: 18 definitions
- Categories: 5 (capabilities, limits, resources, deployment, support)
- All keys properly formatted (e.g., `features.compare_mode`)

---

## 🔄 Next Steps

After seeding entitlement definitions:
1. ✅ Create Subscription Plans (Free, Pro, Business, Enterprise)
2. ✅ Create Plan Entitlements (map plans to definitions)
3. ✅ Test user registration and login
4. ✅ Verify entitlement snapshots are generated

---

**Script Location:** `scripts/seedEntitlementDefinitions.ts`  
**API Endpoints:** `/api/admin/entitlements/definitions`
