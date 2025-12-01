# Sovereign AI - Admin Portal Backend

Node.js + Express + MongoDB backend API for Sovereign AI Admin Portal and Desktop App Authentication.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secrets
```

3. **Start development server:**
```bash
npm run dev
```

Server will start on `http://localhost:3000`

**API Base URLs:**
- User Authentication: `http://localhost:3000/api`
- Admin Portal: `http://localhost:3000/api/admin`

## 📁 Project Structure

```
Backend/
├── src/
│   ├── config/          # Configuration files
│   │   └── database.ts  # PostgreSQL connection
│   ├── controllers/     # Request handlers
│   │   ├── users.controller.ts
│   │   ├── subscriptions.controller.ts
│   │   ├── payments.controller.ts
│   │   ├── licenses.controller.ts
│   │   ├── models.controller.ts
│   │   ├── auditLogs.controller.ts
│   │   └── dashboard.controller.ts
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts      # JWT authentication
│   │   ├── rateLimiter.ts
│   │   ├── errorHandler.ts
│   │   └── validation.ts
│   ├── routes/          # API routes
│   │   ├── index.ts
│   │   ├── users.routes.ts
│   │   ├── subscriptions.routes.ts
│   │   ├── payments.routes.ts
│   │   ├── licenses.routes.ts
│   │   ├── models.routes.ts
│   │   ├── auditLogs.routes.ts
│   │   └── dashboard.routes.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   └── server.ts        # Main entry point
├── .env.example         # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔑 API Endpoints

### Base URL
`/api/admin`

## 🔑 API Endpoints

### Public Authentication Endpoints

#### User Authentication (Desktop App)
**Base URL:** `/api/auth`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/register` | POST | Register new user (Desktop app first-time setup) |
| `/login` | POST | Login and get session token for offline usage (30-90 days) |
| `/refresh` | POST | Refresh expired session token |
| `/verify` | GET | Verify current session token (Requires: Bearer Token) |

**📖 See [AUTHENTICATION_GUIDE.md](AUTHENTICATION_GUIDE.md) for complete user authentication flow**

#### Admin Authentication (Admin Portal)
**Base URL:** `/api/admin/auth`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/login` | POST | Admin login (8-hour access token) |
| `/refresh` | POST | Refresh admin access token |
| `/verify` | GET | Verify admin token (Requires: Admin Token) |
| `/logout` | POST | Admin logout (Requires: Admin Token) |

**🔐 See [ADMIN_AUTH_GUIDE.md](ADMIN_AUTH_GUIDE.md) for complete admin authentication flow**

### Protected Admin Endpoints

**Base URL:** `/api/admin`

All endpoints below require Admin JWT token in Authorization header:
```
Authorization: Bearer <admin_token>
```

| Module | Endpoint | Method | Auth Required |
|--------|----------|--------|---------------|
| **Admin Profile** | `/profile` | GET | admin, superadmin, support |
| | `/profile` | PUT | admin, superadmin, support |
| | `/change-password` | POST | admin, superadmin, support |
| **Users** | `/users` | GET | admin, superadmin, support |
| | `/users/:id` | GET | admin, superadmin, support |
| | `/users/:id` | PUT | admin, superadmin |
| | `/users/:id` | DELETE | superadmin |
| | `/users/:id/impersonate` | POST | superadmin |
| | `/users/bulk-disable` | POST | admin, superadmin |
| **Health** | `/health` | GET | None (Public) |

**Note:** Subscription, Payment, License, Model, and Dashboard endpoints are planned for future releases.

## 📚 Documentation Files

| File | Description |
|------|-------------|
| **[AUTHENTICATION_GUIDE.md](AUTHENTICATION_GUIDE.md)** | Complete user authentication flow for desktop app with offline usage (30-90 day tokens) |
| **[ADMIN_AUTH_GUIDE.md](ADMIN_AUTH_GUIDE.md)** | Admin authentication system with lockout security (8-hour tokens) |
| **[POSTMAN_TESTING_GUIDE.md](POSTMAN_TESTING_GUIDE.md)** | Comprehensive Postman testing guide for both user and admin endpoints |
| **[RENDER_DEPLOYMENT_CHECKLIST.md](RENDER_DEPLOYMENT_CHECKLIST.md)** | Step-by-step deployment guide for Render.com |
| **[AUTH_UPDATE.md](AUTH_UPDATE.md)** | Quick reference for authentication endpoints |
| **generate-token.js** | Utility to generate JWT tokens for testing |

## 🔒 Security

### Two-Tier Authentication System

#### 1. User Authentication (Desktop App)
- **Purpose**: Offline-first desktop application access
- **Token Duration**: 30-90 days based on subscription
- **Token Type**: `type: "user"` in JWT payload
- **Features**:
  - Trial Users: 30-day session tokens
  - Paid Users: 90-day session tokens  
  - Expired Users: 7-day grace period
  - Offline Usage: App works offline with valid session token
  - Auto-Refresh: Desktop app automatically refreshes tokens when online

#### 2. Admin Authentication (Admin Portal)
- **Purpose**: Secure admin portal access
- **Token Duration**: 8 hours
- **Token Type**: `type: "admin"` in JWT payload
- **Features**:
  - **Account Lockout**: 5 failed attempts = 1 hour lockout
  - **Role-Based Access**: admin, superadmin, support
  - **Shorter Sessions**: Enhanced security with 8-hour tokens
  - **Separate Database**: Admins stored in `admins` collection

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Special characters required for admin passwords (@$!%*?&)

### Rate Limiting
- **Read operations (GET)**: 100/min
- **Write operations (POST/PUT/DELETE)**: 30/min
- **Bulk operations**: 10/min

### Authentication
- JWT-based session tokens
- Refresh tokens for silent renewal
- Bcrypt password hashing (12 rounds in production)
- Token payload includes role, email, userId/adminId, subscriptionStatus (users only)

### Role-Based Access Control

#### User Roles
- `user`: Desktop app access only (no admin portal)

#### Admin Roles
- `admin`: Full access to all operations
- `support`: Read-only access

## 🛠️ Development

### Scripts
```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
npm run test     # Run tests
```

### Environment Variables
See `.env.example` for all available environment variables.

## 📊 Database Schema (MongoDB)

### Collections
- `users` - User accounts for desktop app with authentication
- `admins` - Admin portal users with enhanced security (lockout, roles)
- `subscriptions` - User subscription records
- `subscriptionplans` - Available subscription plans
- `payments` - Payment transaction history
- `licenses` - License keys and activations
- `models` - AI model registry
- `installedmodels` - User's installed models tracking
- `apikeys` - API key management
- `auditlogs` - System audit trail
- `conversations` - User conversation history

See models in `src/models/` for complete schema details.

## 🧪 Testing

### Quick Test with Postman

1. **Start server:** `npm run dev`
2. **Register user:**
   ```
   POST http://localhost:3000/api/admin/auth/register
   Body: { "name": "Test", "email": "test@example.com", "password": "Test123" }
   ```
3. **Use returned sessionToken** for other endpoints

**📖 See [POSTMAN_TESTING_GUIDE.md](POSTMAN_TESTING_GUIDE.md) for complete testing instructions**

### Run Tests
```bash
npm test  # Coming soon
```

## 🐛 Error Handling

All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Error Codes
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Request validation failed
- `RATE_LIMITED`: Too many requests
- `SERVER_ERROR`: Internal server error

## 🎯 Desktop App Integration

This backend provides authentication for the **Sovereign AI Desktop Application**:

1. **First-time Setup:** User registers → Gets 30-day trial session token
2. **Model Download:** User downloads Gemma model (stored locally)
3. **Offline Usage:** App validates session token locally (no internet needed)
4. **Token Expiry:** App prompts user to go online and refresh token
5. **Subscription:** User upgrades → Gets 90-day session tokens

**📖 See [AUTHENTICATION_GUIDE.md](AUTHENTICATION_GUIDE.md) for desktop app integration details**

## 📄 License

TussleDigital

## 👥 Contributors

Backend Team

---

**Version**: 1.0.0  
**Last Updated**: November 2025
