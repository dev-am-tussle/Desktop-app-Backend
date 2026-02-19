/**
 * Database Migration Script
 * Converts existing subscription plans from legacy flat pricing to new multi-currency structure
 * 
 * Legacy structure:
 * {
 *   price_monthly: 1999,
 *   price_yearly: 19999,
 *   currency: 'AUD',
 *   stripe_product_id: 'prod_xxx',
 *   stripe_price_monthly_id: 'price_xxx',
 *   stripe_price_yearly_id: 'price_yyy'
 * }
 * 
 * New structure:
 * {
 *   prices: {
 *     monthly: { AUD: { amount: 1999, stripe_price_id: 'price_xxx', source: 'base' } },
 *     yearly: { AUD: { amount: 19999, stripe_price_id: 'price_yyy', source: 'base' } }
 *   },
 *   pricing_metadata: {
 *     base_currency: 'AUD',
 *     base_amount_monthly: 1999,
 *     base_amount_yearly: 19999,
 *     supported_currencies: ['AUD'],
 *     conversion_applied_on: Date,
 *     conversion_source: 'migration'
 *   }
 * }
 * 
 * Usage:
 * node scripts/migrateToMultiCurrency.js
 */

import mongoose from 'mongoose';
import SubscriptionPlan from '../src/models/SubscriptionPlan.model';
import dotenv from 'dotenv';

dotenv.config();

async function migrateToMultiCurrency() {
  try {
    console.log('🔄 Starting migration to multi-currency pricing structure...\n');
    
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/superportal';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all plans with legacy pricing fields
    const plans = await SubscriptionPlan.find({
      $or: [
        { price_monthly: { $exists: true, $ne: null } },
        { stripe_price_monthly_id: { $exists: true, $ne: null } }
      ]
    });
    
    console.log(`📊 Found ${plans.length} plans to migrate\n`);
    
    if (plans.length === 0) {
      console.log('✅ No plans to migrate. All plans are already in multi-currency format.');
      await mongoose.connection.close();
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const plan of plans) {
      try {
        // Skip if already migrated
        if (plan.prices && plan.prices.monthly && Object.keys(plan.prices.monthly).length > 0) {
          console.log(`⏭️  Skipping ${plan.name} - already migrated`);
          continue;
        }
        
        const planData = plan as any; // Cast to any to access legacy fields
        const baseCurrency = planData.currency || 'AUD';
        const baseAmountMonthly = planData.price_monthly || 0;
        const baseAmountYearly = planData.price_yearly || null;
        const stripeProductId = planData.stripe_product_id;
        const stripePriceMonthlyId = planData.stripe_price_monthly_id;
        const stripePriceYearlyId = planData.stripe_price_yearly_id;
        
        // Build new prices structure
        const newPrices: any = {
          monthly: {},
        };
        
        // Add monthly price
        if (baseAmountMonthly > 0) {
          newPrices.monthly[baseCurrency] = {
            amount: baseAmountMonthly,
            stripe_price_id: stripePriceMonthlyId || '',
            source: 'base',  // All migrated prices are marked as 'base'
          };
        }
        
        // Add yearly price if exists
        if (baseAmountYearly && baseAmountYearly > 0) {
          newPrices.yearly = {};
          newPrices.yearly[baseCurrency] = {
            amount: baseAmountYearly,
            stripe_price_id: stripePriceYearlyId || '',
            source: 'base',
          };
        }
        
        // Build pricing metadata
        const pricingMetadata = {
          base_currency: baseCurrency,
          base_amount_monthly: baseAmountMonthly,
          base_amount_yearly: baseAmountYearly,
          supported_currencies: [baseCurrency],
          conversion_applied_on: new Date(),
          conversion_source: 'migration',  // Track this came from migration
        };
        
        // Update plan
        const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
          plan._id,
          {
            prices: newPrices,
            pricing_metadata: pricingMetadata,
            // Keep legacy fields for safety, but they're no longer used
          },
          { new: true, runValidators: true }
        );
        
        console.log(`✅ Migrated: ${plan.name} (${baseCurrency})`);
        console.log(`   Monthly: ${baseAmountMonthly} cents -> ${newPrices.monthly[baseCurrency].stripe_price_id}`);
        if (newPrices.yearly) {
          console.log(`   Yearly: ${baseAmountYearly} cents -> ${newPrices.yearly[baseCurrency].stripe_price_id}`);
        }
        console.log();
        
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to migrate ${plan.name}:`, error.message);
        console.error(`   Plan ID: ${plan._id}\n`);
        failureCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount} plans`);
    console.log(`❌ Failed: ${failureCount} plans`);
    console.log(`📈 Total: ${successCount + failureCount} plans processed`);
    console.log('='.repeat(60));
    
    if (failureCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('All plans are now using multi-currency pricing structure.');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review failed plans above.');
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToMultiCurrency();
