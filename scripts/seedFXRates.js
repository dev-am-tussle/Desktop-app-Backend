/**
 * Seed FX Rates Script - Simple
 * Seeds initial FX rates into MongoDB
 * 
 * Usage:
 *   npm run seed:fx-rates "mongodb+srv://user:pass@cluster/db"
 *   node scripts/seedFXRates.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// FXRate Schema
const FXRateSchema = new mongoose.Schema(
  {
    from_currency: { type: String, required: true },
    to_currency: { type: String, required: true },
    rate: { type: Number, required: true, min: 0.001 },
    is_active: { type: Boolean, default: true },
    effective_from: { type: Date, default: () => new Date() },
    effective_to: { type: Date, default: null },
    updated_by: { type: String, default: 'admin' },
    source: { type: String, enum: ['admin_manual', 'stripe_api'], default: 'admin_manual' },
    notes: { type: String, default: null },
  },
  { timestamps: true, collection: 'fxrates' }
);

const FXRate = mongoose.model('FXRate', FXRateSchema);

// FX Rates Data (Base: AUD)
const FX_RATES_DATA = [
  { from_currency: 'AUD', to_currency: 'USD', rate: 0.65, notes: 'AUD 1 = USD 0.65' },
  { from_currency: 'AUD', to_currency: 'INR', rate: 54.25, notes: 'AUD 1 = INR 54.25' },
  { from_currency: 'AUD', to_currency: 'GBP', rate: 0.51, notes: 'AUD 1 = GBP 0.51' },
  { from_currency: 'AUD', to_currency: 'EUR', rate: 0.60, notes: 'AUD 1 = EUR 0.60' },
  { from_currency: 'AUD', to_currency: 'CAD', rate: 0.89, notes: 'AUD 1 = CAD 0.89' },
  { from_currency: 'AUD', to_currency: 'SGD', rate: 0.87, notes: 'AUD 1 = SGD 0.87' },
  { from_currency: 'AUD', to_currency: 'JPY', rate: 97.85, notes: 'AUD 1 = JPY 97.85' },
  { from_currency: 'AUD', to_currency: 'NZD', rate: 1.08, notes: 'AUD 1 = NZD 1.08' },
];

async function seedFXRates() {
  try {
    const mongoUri = process.argv[2] || process.env.MONGODB_URI || 'mongodb://localhost:27017/superportal';

    if (!mongoUri) {
      console.error('\n❌ MongoDB URI not found');
      console.error('Usage: npm run seed:fx-rates "mongodb+srv://..."');
      process.exit(1);
    }

    console.log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected\n');

    // Clear collection
    console.log('🗑️  Clearing FXRate collection...');
    await FXRate.deleteMany({});
    console.log('✅ Cleared\n');

    // Insert rates
    console.log('💾 Seeding rates...');
    const created = await FXRate.insertMany(
      FX_RATES_DATA.map((rate) => ({
        ...rate,
        is_active: true,
        source: 'admin_manual',
        updated_by: 'admin',
      }))
    );

    console.log(`✅ ${created.length} rates seeded:\n`);
    created.forEach((r) => {
      console.log(`   • ${r.from_currency} → ${r.to_currency}: ${r.rate}`);
    });

    console.log('\n🎉 Done!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

seedFXRates();
