# FX Rates Seeding Guide

## Overview
Scripts to seed initial FX rates into MongoDB with base currency AUD.

## Available Scripts

### 1. JavaScript Version (Node.js)
```bash
npm run seed:fx-rates
```
**Use this when:**
- Running on production server (no TypeScript compilation needed)
- You have Node.js installed but not TypeScript
- Quick one-time setup

**Features:**
- ✅ No compilation step needed
- ✅ Direct Node.js execution
- ✅ Self-contained with inline schema

### 2. TypeScript Version
```bash
npx ts-node scripts/seedFXRates.ts
```
**Use this when:**
- Development environment with TypeScript
- Better IDE support and type checking
- Want to use actual FXRate model from codebase

**Features:**
- ✅ Full type safety
- ✅ Uses actual FXRate model
- ✅ Better error checking

## Seeded Currencies

| Base | To Currency | Rate | Notes |
|------|---|---|---|
| AUD | USD | 0.65 | AUD 1 = USD 0.65 |
| AUD | INR | 54.25 | AUD 1 = INR 54.25 |
| AUD | GBP | 0.51 | AUD 1 = GBP 0.51 |
| AUD | EUR | 0.60 | AUD 1 = EUR 0.60 |
| AUD | CAD | 0.89 | AUD 1 = CAD 0.89 |
| AUD | SGD | 0.87 | AUD 1 = SGD 0.87 |
| AUD | JPY | 97.85 | AUD 1 = JPY 97.85 |
| AUD | NZD | 1.08 | AUD 1 = NZD 1.08 |

## What Gets Set

All rates are seeded with:
```json
{
  "is_active": true,
  "effective_from": "2026-02-19T...",
  "source": "admin_manual",
  "updated_by": "admin-seed-script",
  "notes": "Initial seeding via script"
}
```

## Running the Script

### Step 1: Ensure MongoDB is Running
```bash
# If using local MongoDB
mongod

# Or ensure your MongoDB_URI environment variable is set
echo $MONGODB_URI
```

### Step 2: Run the Seed Script

**JavaScript:**
```bash
cd c:\Users\AshutoshMaurya\DEV-SPC\SuperPortal\Backend
npm run seed:fx-rates
```

**TypeScript:**
```bash
cd c:\Users\AshutoshMaurya\DEV-SPC\SuperPortal\Backend
npx ts-node scripts/seedFXRates.ts
```

### Step 3: Verify in MongoDB

```bash
# Connect to MongoDB
mongosh

# Switch to superportal database
use superportal

# Check FX rates
db.fxrates.find()

# Count total active rates
db.fxrates.countDocuments({ is_active: true })
```

## Expected Output

```
📡 Connecting to MongoDB: mongodb://localhost:27017/superportal
✅ MongoDB connected successfully

🗑️  Dropping existing FXRate collection...
✅ Existing FXRate collection dropped

💾 Seeding FX rates into database...
✅ Successfully seeded 8 FX rates:
   • AUD → USD: 0.65 (AUD 1 = USD 0.65)
   • AUD → INR: 54.25 (AUD 1 = INR 54.25)
   • AUD → GBP: 0.51 (AUD 1 = GBP 0.51)
   • AUD → EUR: 0.60 (AUD 1 = EUR 0.60)
   • AUD → CAD: 0.89 (AUD 1 = CAD 0.89)
   • AUD → SGD: 0.87 (AUD 1 = SGD 0.87)
   • AUD → JPY: 97.85 (AUD 1 = JPY 97.85)
   • AUD → NZD: 1.08 (AUD 1 = NZD 1.08)

✅ Total active FX rates in database: 8

🎉 FX rates seeding completed successfully!
```

## Modifying Rates

### To add new rates:
1. Edit `FX_RATES_DATA` array in either script
2. Add new object with `from_currency`, `to_currency`, `rate`, `notes`
3. Run the seed script again

### Example of adding a new rate:
```javascript
{
  from_currency: 'AUD',
  to_currency: 'CHF',  // Swiss Franc
  rate: 0.58,
  notes: 'AUD 1 = CHF 0.58',
}
```

## Troubleshooting

### Error: "MongoDB connected failed"
- Check if MongoDB is running on your system
- Verify `MONGODB_URI` environment variable is set correctly
- Default: `mongodb://localhost:27017/superportal`

### Error: "No such file or directory"
- Ensure you're running the script from the Backend root directory
- Check file paths match your project structure

### Script hangs
- MongoDB might be taking too long to connect
- Check MongoDB service status
- Verify network connectivity if using remote MongoDB

## Notes

- **⚠️ Warning**: Script will drop existing FXRate collection and recreate it
- If you need to preserve existing rates, comment out the `drop()` call
- Rates are marked as `is_active: true` by default
- Use admin portal to update rates after seeding for audit trail tracking
- All rates are seeded with `source: 'admin_manual'` to indicate they came from admin

## API Usage After Seeding

Once seeded, fetch rates from:

```bash
# Get current active rates (public endpoint)
curl http://localhost:5000/api/fx-rates

# List all rates (admin only)
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:5000/api/admin/fx-rates/all
```

## Response Example

```json
{
  "AUD": 1.0,
  "USD": 0.65,
  "INR": 54.25,
  "GBP": 0.51,
  "EUR": 0.60,
  "CAD": 0.89,
  "SGD": 0.87,
  "JPY": 97.85,
  "NZD": 1.08,
  "last_updated": "2026-02-19T10:30:00.000Z"
}
```
