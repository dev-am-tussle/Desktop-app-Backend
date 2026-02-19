/**
 * Script to seed initial FX rates into MongoDB (TypeScript version)
 * Base currency: AUD
 * Source: admin_manual
 * 
 * Usage:
 *   npx ts-node scripts/seedFXRates.ts                    (uses MONGODB_URI from .env)
 *   npx ts-node scripts/seedFXRates.ts "mongodb+srv://user:pass@cluster/db"    (pass URI as argument)
 *   MONGODB_URI=mongodb://localhost npx ts-node scripts/seedFXRates.ts          (set env var before running)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FXRate } from '../src/models';

dotenv.config();

// FX rates data: Base AUD = 1.0
// These are approximate mid-market rates as of Feb 2026
interface FXRateSeedData {
  from_currency: string;
  to_currency: string;
  rate: number;
  notes: string;
}

const FX_RATES_DATA: FXRateSeedData[] = [
  {
    from_currency: 'AUD',
    to_currency: 'USD',
    rate: 0.65,
    notes: 'AUD 1 = USD 0.65',
  },
  {
    from_currency: 'AUD',
    to_currency: 'INR',
    rate: 54.25,
    notes: 'AUD 1 = INR 54.25',
  },
  {
    from_currency: 'AUD',
    to_currency: 'GBP',
    rate: 0.51,
    notes: 'AUD 1 = GBP 0.51',
  },
  {
    from_currency: 'AUD',
    to_currency: 'EUR',
    rate: 0.60,
    notes: 'AUD 1 = EUR 0.60',
  },
  {
    from_currency: 'AUD',
    to_currency: 'CAD',
    rate: 0.89,
    notes: 'AUD 1 = CAD 0.89',
  },
  {
    from_currency: 'AUD',
    to_currency: 'SGD',
    rate: 0.87,
    notes: 'AUD 1 = SGD 0.87',
  },
  {
    from_currency: 'AUD',
    to_currency: 'JPY',
    rate: 97.85,
    notes: 'AUD 1 = JPY 97.85',
  },
  {
    from_currency: 'AUD',
    to_currency: 'NZD',
    rate: 1.08,
    notes: 'AUD 1 = NZD 1.08',
  },
];

async function seedFXRates(): Promise<void> {
  try {
    // Get MongoDB URI from command-line argument, environment variable, or use default
    const mongoUri = process.argv[2] || process.env.MONGODB_URI || 'mongodb://localhost:27017/superportal';
    
    if (!mongoUri) {
      console.error('\n❌ Error: MONGODB_URI not provided');
      console.error('\n📝 Usage:');
      console.error('   npx ts-node scripts/seedFXRates.ts');
      console.error('   OR');
      console.error('   npx ts-node scripts/seedFXRates.ts "mongodb+srv://user:pass@cluster.mongodb.net/database"');
      console.error('\n💡 Tips:');
      console.error('   1. Set MONGODB_URI in .env file');
      console.error('   2. Or pass MongoDB URI as command-line argument');
      console.error('   3. Default fallback: mongodb://localhost:27017/superportal\n');
      process.exit(1);
    }

    console.log(`\n📡 Connecting to MongoDB: ${mongoUri.substring(0, 50)}...`);

    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');

    // Drop existing FXRate collection to start fresh
    console.log('\n🗑️  Dropping existing FXRate collection...');
    try {
      await FXRate.collection.drop();
      console.log('✅ Existing FXRate collection dropped');
    } catch (error: any) {
      if (error.code !== 26) {
        // 26 = namespace does not exist (collection doesn't exist)
        throw error;
      }
      console.log('ℹ️  No existing FXRate collection to drop');
    }

    // Insert FX rates
    console.log('\n💾 Seeding FX rates into database...');
    const createdRates = await FXRate.insertMany(
      FX_RATES_DATA.map((rate) => ({
        ...rate,
        effective_from: new Date(),
        is_active: true,
        source: 'admin_manual',
        updated_by: 'admin',
      }))
    );

    console.log(`✅ Successfully seeded ${createdRates.length} FX rates:`);
    createdRates.forEach((rate) => {
      console.log(
        `   • ${rate.from_currency} → ${rate.to_currency}: ${rate.rate} (${rate.notes})`
      );
    });

    // Verify all rates are active
    const activeRates = await FXRate.find({ is_active: true });
    console.log(
      `\n✅ Total active FX rates in database: ${activeRates.length}`
    );

    console.log('\n🎉 FX rates seeding completed successfully!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error seeding FX rates:', error.message);
    console.error(error);
process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
  }
}

// Run the seed script
seedFXRates();
