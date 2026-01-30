/**
 * Seed Script: Subscription Plans
 * Purpose: Populate SubscriptionPlan collection with all pricing tiers
 * Usage: npx ts-node scripts/seedSubscriptionPlans.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import SubscriptionPlan from '../src/models/SubscriptionPlan.model';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUBSCRIPTION_PLANS = [
  {
    name: 'free',
    display_name: 'Free Plan',
    slug: 'free',
    description: 'Basic features for individual users to get started',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'AUD',
    is_contact_sales: false,
    stripe_product_id: null,
    stripe_price_monthly_id: null,
    stripe_price_yearly_id: null,
    status: 'active',
    sort_order: 1,
  },
  {
    name: 'pro',
    display_name: 'Pro Plan',
    slug: 'pro',
    description: 'Advanced features for professionals and power users',
    price_monthly: 19.99,
    price_yearly: 199.0,
    currency: 'AUD',
    is_contact_sales: false,
    stripe_product_id: 'prod_ProPlan2026', // Update with real Stripe IDs
    stripe_price_monthly_id: 'price_ProMonthly',
    stripe_price_yearly_id: 'price_ProYearly',
    status: 'active',
    sort_order: 2,
  },
  {
    name: 'business',
    display_name: 'Business Plan',
    slug: 'business',
    description: 'Complete features for teams and organizations',
    price_monthly: 49.99,
    price_yearly: 499.0,
    currency: 'AUD',
    is_contact_sales: false,
    stripe_product_id: 'prod_BusinessPlan2026',
    stripe_price_monthly_id: 'price_BusinessMonthly',
    stripe_price_yearly_id: 'price_BusinessYearly',
    status: 'active',
    sort_order: 3,
  },
  {
    name: 'enterprise',
    display_name: 'Enterprise Plan',
    slug: 'enterprise',
    description: 'Custom solutions with dedicated support for large organizations',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'AUD',
    is_contact_sales: true,
    stripe_product_id: null,
    stripe_price_monthly_id: null,
    stripe_price_yearly_id: null,
    status: 'active',
    sort_order: 4,
  },
];

async function seedSubscriptionPlans() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📋 Starting Subscription Plans Seeding...');
    console.log(`📊 Total plans to seed: ${SUBSCRIPTION_PLANS.length}`);

    // Check existing plans
    const existingCount = await SubscriptionPlan.countDocuments();
    console.log(`📦 Existing plans in database: ${existingCount}`);

    if (existingCount > 0) {
      console.log('\n⚠️  Database already contains subscription plans.');
      console.log('Clearing existing plans and reseeding...\n');
      await SubscriptionPlan.deleteMany({});
    }

    // Insert plans
    const result = await SubscriptionPlan.insertMany(SUBSCRIPTION_PLANS);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully inserted: ${result.length} plans`);
    console.log('='.repeat(60));

    // Show plan details with IDs
    console.log('\n📑 SUBSCRIPTION PLANS:');
    for (const plan of result) {
      console.log(`\n  ${plan.display_name}`);
      console.log(`    ID: ${plan._id}`);
      console.log(`    Slug: ${plan.slug}`);
      console.log(`    Monthly: ${plan.currency} ${plan.price_monthly}`);
      console.log(`    Yearly: ${plan.currency} ${plan.price_yearly}`);
      console.log(`    Contact Sales: ${plan.is_contact_sales}`);
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n⚠️  IMPORTANT: Copy these Plan IDs for the next seeder (Plan Entitlements)');
    
  } catch (error: any) {
    console.error('\n❌ SEEDING FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeder
seedSubscriptionPlans();
