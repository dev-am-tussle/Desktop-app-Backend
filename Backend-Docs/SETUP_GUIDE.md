# 🚀 SOVEREIGN AI - COMPLETE SETUP GUIDE

## 📋 Prerequisites
- Node.js v18+
- MongoDB (Azure Cosmos DB)
- TypeScript

---

## 🔧 Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure .env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
PORT=3000
```

---

## 🌱 Database Seeding (REQUIRED)

Run seeders in order to populate the database:

### Option 1: Run All Seeders (Recommended)
```bash
npx ts-node scripts/seedAll.ts
```

This will automatically run:
1. **Entitlement Definitions** (18 definitions)
2. **Subscription Plans** (4 plans: Free, Pro, Business, Enterprise)
3. **Plan Entitlements** (76 mappings)

### Option 2: Run Individual Seeders
```bash
# Step 1: Seed entitlement definitions
npx ts-node scripts/seedEntitlementDefinitions.ts

# Step 2: Seed subscription plans
npx ts-node scripts/seedSubscriptionPlans.ts

# Step 3: Seed plan entitlements
npx ts-node scripts/seedPlanEntitlements.ts
```

---

## 🏃 Running the Server

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Server will start on `http://localhost:3000`

---

## 📡 API Endpoints

### **Authentication (Public)**

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass@123"
}
```

**Response:**
```json
{
  "data": {
    "user": { ... },
    "authentication": {
      "sessionToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresAt": "2026-02-27T10:00:00Z"
    },
    "entitlements": {
      "capabilities": { ... },
      "limits": { ... },
      "resources": { ... },
      "deployment": { ... },
      "support": { ... }
    }
  }
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass@123"
}
```

**Response:** Same as registration (includes entitlement snapshot)

---

### **Entitlements (Authenticated)**

#### Sync Entitlements
```http
POST /api/entitlements/sync
Authorization: Bearer <sessionToken>
```

**Force regenerate entitlement snapshot (e.g., after plan upgrade)**

#### Get Current Entitlements
```http
GET /api/entitlements
Authorization: Bearer <sessionToken>
```

#### Check Capability
```http
GET /api/entitlements/validate/features.arena_mode
Authorization: Bearer <sessionToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "capability": "features.arena_mode",
    "enabled": false,
    "message": "This capability requires Pro plan or higher"
  }
}
```

#### Check Limit
```http
GET /api/entitlements/check-limit/limits.file_uploads_per_day
Authorization: Bearer <sessionToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "limit_key": "limits.file_uploads_per_day",
    "limit": 5,
    "used": 2,
    "remaining": 3,
    "available": true
  }
}
```

---

### **Admin Endpoints (Admin Auth Required)**

#### Admin Login
```http
POST /api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@sovereignai.com",
  "password": "AdminPass@123"
}
```

#### Create Entitlement Definition
```http
POST /api/admin/entitlements/definitions
Authorization: Bearer <adminToken>
Content-Type: application/json

{
  "key": "features.advanced_analytics",
  "type": "boolean",
  "category": "capabilities",
  "description": "Advanced analytics dashboard",
  "default_value": false,
  "validation_rules": null
}
```

#### Get All Definitions
```http
GET /api/admin/entitlements/definitions
Authorization: Bearer <adminToken>
```

---

## 🏗️ Architecture

### **Database Collections**

1. **users** - User accounts with plan_id and subscription_status
2. **subscriptionplans** - Pricing tiers (Free, Pro, Business, Enterprise)
3. **entitlementdefinitions** - Master list of all entitlements
4. **planentitlements** - Maps plans to entitlements (plan_id → entitlement_key → value)
5. **userentitlementoverrides** - Custom per-user overrides
6. **entitlementcaches** - Generated snapshots with HMAC signature

### **Data Flow**

```
User Login
  ↓
Fetch user.plan_id
  ↓
Query PlanEntitlement (by plan_id)
  ↓
Query UserEntitlementOverride (by user_id)
  ↓
Merge (overrides win)
  ↓
Group into 5 buckets (capabilities, limits, resources, deployment, support)
  ↓
Generate HMAC signature
  ↓
Cache snapshot (TTL: 12-168 hours based on plan)
  ↓
Return to client
```

---

## 🔐 Entitlement Categories

### **1. Capabilities** (Boolean features)
- `features.arena_mode` - Model comparison
- `features.client_mode` - Multi-user hosting
- `features.file_upload` - File uploads
- `features.prompt_manager` - Prompt library
- `features.web_search` - Web search integration

### **2. Limits** (Numeric or "unlimited")
- `limits.file_uploads_per_day` - Daily upload limit
- `limits.file_size_mb` - Max file size
- `limits.prompts_saved` - Saved prompts
- `limits.models_local` - Local models
- `limits.models_api` - API models
- `limits.users_max` - User seats

### **3. Resources** (Arrays - whitelists)
- `models.local.allowed` - Allowed local models
- `models.api.allowed` - Allowed API providers
- `web.search.providers` - Search providers
- `file.types.allowed` - File types

### **4. Deployment** (Configuration)
- `deployment.mode` - cloud/hybrid/local
- `deployment.offline_cache_ttl_hours` - Cache validity
- `deployment.client_hosting_enabled` - Can host for others

### **5. Support** (Support tier)
- `support.level` - community/email/priority/dedicated

---

## 🧪 Testing

### **Manual Testing with Postman**

1. Import the collection from `ENTITLEMENT_TESTING_GUIDE.md`
2. Register a new user
3. Login to get entitlement snapshot
4. Try accessing arena mode (should fail for Free plan)
5. Upgrade to Pro plan
6. Sync entitlements
7. Try arena mode again (should succeed)

### **Example Test Flow**

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test@123"}'

# 2. Login (get sessionToken)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123"}'

# 3. Check entitlements
curl -X GET http://localhost:3000/api/entitlements \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# 4. Try arena mode (will fail for Free plan)
curl -X POST http://localhost:3000/api/chat/compare \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test"}],"models":[...]}'
```

---

## 📝 Plan Comparison

| Feature | Free | Pro | Business | Enterprise |
|---------|------|-----|----------|------------|
| **Price** | $0 | $19.99/mo | $49.99/mo | Contact Sales |
| **Arena Mode** | ❌ | ✅ | ✅ | ✅ |
| **Client Mode** | ❌ | ❌ | ✅ | ✅ |
| **File Uploads/Day** | 5 | Unlimited | Unlimited | Unlimited |
| **File Size** | 10 MB | 30 MB | Unlimited | Unlimited |
| **Saved Prompts** | 5 | 100 | Unlimited | Unlimited |
| **Local Models** | 1 | 5 | 10 | Unlimited |
| **API Models** | 1 | 5 | 10 | Unlimited |
| **Users/Seats** | 1 | 1 | 3 | Unlimited |
| **Offline Cache** | 12 hours | 48 hours | 72 hours | 168 hours |
| **Support** | Community | Email | Priority | Dedicated |

---

## 🔄 Upgrade Flow

### **User Upgrades from Free → Pro**

1. User selects Pro plan in app
2. Frontend calls payment endpoint
3. Stripe payment processed
4. Webhook updates user:
   ```javascript
   {
     plan_id: proPlanId,
     subscription_status: "active",
     subscription_ends_at: nextBillingDate,
     stripeSubscriptionId: "sub_xyz789"
   }
   ```
5. Old entitlement cache revoked
6. User syncs entitlements
7. New snapshot generated with Pro features

---

## 📚 Documentation

- [Complete User Flow](COMPLETE_USER_FLOW.md) - End-to-end user journey
- [New Structure Explained](NEW_STRUCTURE_EXPLAINED.md) - Architecture details
- [Seeding Instructions](SEEDING_INSTRUCTIONS.md) - Database setup
- [Entitlement Testing Guide](ENTITLEMENT_TESTING_GUIDE.md) - Postman tests

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check MongoDB connection
npx ts-node scripts/testConnection.ts
```

### Seeders Failing
```bash
# Clear database and reseed
npx ts-node scripts/clearDatabase.ts
npx ts-node scripts/seedAll.ts
```

### Entitlement Snapshot Not Generated
```bash
# Check logs for errors
# Verify all seeders ran successfully
# Ensure user has plan_id set
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is proprietary. All rights reserved.

---

## 📞 Support

For support, email support@sovereignai.com or join our Discord community.

---

**Built with ❤️ by Sovereign AI Team**
