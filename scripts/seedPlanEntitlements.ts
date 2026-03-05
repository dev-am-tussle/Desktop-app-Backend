/**
 * Seed Script: Plan Entitlements
 * Purpose: Map subscription plans to their entitlements
 * Usage: npx ts-node scripts/seedPlanEntitlements.ts
 * 
 * PREREQUISITE: Run seedSubscriptionPlans.ts and seedEntitlementDefinitions.ts first
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import SubscriptionPlan from '../src/models/SubscriptionPlan.model';
import PlanEntitlement from '../src/models/PlanEntitlement.model';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function seedPlanEntitlements() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📋 Fetching Subscription Plans...');
    
    // Fetch all plans
    const freePlan = await SubscriptionPlan.findOne({ slug: 'free' });
    const proPlan = await SubscriptionPlan.findOne({ slug: 'pro' });
    const businessPlan = await SubscriptionPlan.findOne({ slug: 'business' });
    const enterprisePlan = await SubscriptionPlan.findOne({ slug: 'enterprise' });

    if (!freePlan || !proPlan || !businessPlan || !enterprisePlan) {
      throw new Error('⚠️  All 4 plans must exist! Please run seedSubscriptionPlans.ts first.');
    }

    console.log('✅ Found all 4 plans:');
    console.log(`   Free: ${freePlan._id}`);
    console.log(`   Pro: ${proPlan._id}`);
    console.log(`   Business: ${businessPlan._id}`);
    console.log(`   Enterprise: ${enterprisePlan._id}`);

    // Check existing entitlements
    const existingCount = await PlanEntitlement.countDocuments();
    console.log(`\n📦 Existing plan entitlements: ${existingCount}`);

    if (existingCount > 0) {
      console.log('⚠️  Clearing existing plan entitlements...');
      await PlanEntitlement.deleteMany({});
    }

    // ========================================
    // FREE PLAN ENTITLEMENTS
    // ========================================
    const freeEntitlements = [
      // Capabilities
      { plan_id: freePlan._id, entitlement_key: 'features.arena_mode', value: false },
      { plan_id: freePlan._id, entitlement_key: 'features.client_mode', value: false },
      { plan_id: freePlan._id, entitlement_key: 'features.file_upload', value: true },
      { plan_id: freePlan._id, entitlement_key: 'features.prompt_manager', value: true },
      { plan_id: freePlan._id, entitlement_key: 'features.web_search', value: true },
      
      // Limits
      { plan_id: freePlan._id, entitlement_key: 'limits.file_uploads_per_day', value: 5 },
      { plan_id: freePlan._id, entitlement_key: 'limits.file_size_mb', value: 10 },
      { plan_id: freePlan._id, entitlement_key: 'limits.prompts_saved', value: 5 },
      { plan_id: freePlan._id, entitlement_key: 'limits.models_local', value: 1 },
      { plan_id: freePlan._id, entitlement_key: 'limits.models_api', value: 1 },
      { plan_id: freePlan._id, entitlement_key: 'compare_model_limit', value: 2 },
      { plan_id: freePlan._id, entitlement_key: 'limits.users_max', value: 1 },
      
      // Resources
      { plan_id: freePlan._id, entitlement_key: 'models.local.allowed', value: ['llama3'] },
      { plan_id: freePlan._id, entitlement_key: 'models.api.allowed', value: ['openai'] },
      { plan_id: freePlan._id, entitlement_key: 'web.search.providers', value: ['duckduckgo'] },
      { plan_id: freePlan._id, entitlement_key: 'file.types.allowed', value: ['pdf', 'txt', 'docx'] },
      
      // Deployment
      { plan_id: freePlan._id, entitlement_key: 'deployment.mode', value: 'hybrid' },
      { plan_id: freePlan._id, entitlement_key: 'deployment.offline_cache_ttl_hours', value: 12 },
      { plan_id: freePlan._id, entitlement_key: 'deployment.client_hosting_enabled', value: false },
      
      // Support
      { plan_id: freePlan._id, entitlement_key: 'support.level', value: 'community' },
    ];

    // ========================================
    // PRO PLAN ENTITLEMENTS
    // ========================================
    const proEntitlements = [
      // Capabilities
      { plan_id: proPlan._id, entitlement_key: 'features.arena_mode', value: true },
      { plan_id: proPlan._id, entitlement_key: 'features.client_mode', value: false },
      { plan_id: proPlan._id, entitlement_key: 'features.file_upload', value: true },
      { plan_id: proPlan._id, entitlement_key: 'features.prompt_manager', value: true },
      { plan_id: proPlan._id, entitlement_key: 'features.web_search', value: true },
      
      // Limits
      { plan_id: proPlan._id, entitlement_key: 'limits.file_uploads_per_day', value: 'unlimited' },
      { plan_id: proPlan._id, entitlement_key: 'limits.file_size_mb', value: 30 },
      { plan_id: proPlan._id, entitlement_key: 'limits.prompts_saved', value: 100 },
      { plan_id: proPlan._id, entitlement_key: 'limits.models_local', value: 5 },
      { plan_id: proPlan._id, entitlement_key: 'limits.models_api', value: 5 },
      { plan_id: proPlan._id, entitlement_key: 'compare_model_limit', value: 3 },
      { plan_id: proPlan._id, entitlement_key: 'limits.users_max', value: 1 },
      
      // Resources
      { plan_id: proPlan._id, entitlement_key: 'models.local.allowed', value: ['llama3', 'mistral', 'phi'] },
      { plan_id: proPlan._id, entitlement_key: 'models.api.allowed', value: ['openai', 'anthropic', 'google'] },
      { plan_id: proPlan._id, entitlement_key: 'web.search.providers', value: ['duckduckgo', 'perplexity'] },
      { plan_id: proPlan._id, entitlement_key: 'file.types.allowed', value: ['pdf', 'txt', 'docx', 'csv', 'xlsx'] },
      
      // Deployment
      { plan_id: proPlan._id, entitlement_key: 'deployment.mode', value: 'hybrid' },
      { plan_id: proPlan._id, entitlement_key: 'deployment.offline_cache_ttl_hours', value: 48 },
      { plan_id: proPlan._id, entitlement_key: 'deployment.client_hosting_enabled', value: false },
      
      // Support
      { plan_id: proPlan._id, entitlement_key: 'support.level', value: 'email' },
    ];

    // ========================================
    // BUSINESS PLAN ENTITLEMENTS
    // ========================================
    const businessEntitlements = [
      // Capabilities
      { plan_id: businessPlan._id, entitlement_key: 'features.arena_mode', value: true },
      { plan_id: businessPlan._id, entitlement_key: 'features.client_mode', value: true },
      { plan_id: businessPlan._id, entitlement_key: 'features.file_upload', value: true },
      { plan_id: businessPlan._id, entitlement_key: 'features.prompt_manager', value: true },
      { plan_id: businessPlan._id, entitlement_key: 'features.web_search', value: true },
      
      // Limits
      { plan_id: businessPlan._id, entitlement_key: 'limits.file_uploads_per_day', value: 'unlimited' },
      { plan_id: businessPlan._id, entitlement_key: 'limits.file_size_mb', value: 'unlimited' },
      { plan_id: businessPlan._id, entitlement_key: 'limits.prompts_saved', value: 'unlimited' },
      { plan_id: businessPlan._id, entitlement_key: 'limits.models_local', value: 10 },
      { plan_id: businessPlan._id, entitlement_key: 'limits.models_api', value: 10 },
      { plan_id: businessPlan._id, entitlement_key: 'compare_model_limit', value: 4 },
      { plan_id: businessPlan._id, entitlement_key: 'limits.users_max', value: 3 },
      
      // Resources
      { plan_id: businessPlan._id, entitlement_key: 'models.local.allowed', value: ['llama3', 'mistral', 'phi', 'codellama'] },
      { plan_id: businessPlan._id, entitlement_key: 'models.api.allowed', value: ['openai', 'anthropic', 'google', 'cohere'] },
      { plan_id: businessPlan._id, entitlement_key: 'web.search.providers', value: ['duckduckgo', 'perplexity', 'brave'] },
      { plan_id: businessPlan._id, entitlement_key: 'file.types.allowed', value: ['pdf', 'txt', 'docx', 'csv', 'xlsx', 'pptx', 'json'] },
      
      // Deployment
      { plan_id: businessPlan._id, entitlement_key: 'deployment.mode', value: 'hybrid' },
      { plan_id: businessPlan._id, entitlement_key: 'deployment.offline_cache_ttl_hours', value: 72 },
      { plan_id: businessPlan._id, entitlement_key: 'deployment.client_hosting_enabled', value: true },
      
      // Support
      { plan_id: businessPlan._id, entitlement_key: 'support.level', value: 'priority' },
    ];

    // ========================================
    // ENTERPRISE PLAN ENTITLEMENTS
    // ========================================
    const enterpriseEntitlements = [
      // Capabilities
      { plan_id: enterprisePlan._id, entitlement_key: 'features.arena_mode', value: true },
      { plan_id: enterprisePlan._id, entitlement_key: 'features.client_mode', value: true },
      { plan_id: enterprisePlan._id, entitlement_key: 'features.file_upload', value: true },
      { plan_id: enterprisePlan._id, entitlement_key: 'features.prompt_manager', value: true },
      { plan_id: enterprisePlan._id, entitlement_key: 'features.web_search', value: true },
      
      // Limits
      { plan_id: enterprisePlan._id, entitlement_key: 'limits.file_uploads_per_day', value: 'unlimited' },
      { plan_id: enterprisePlan._id, entitlement_key: 'limits.file_size_mb', value: 'unlimited' },
      { plan_id: enterprisePlan._id, entitlement_key: 'limits.prompts_saved', value: 'unlimited' },
      { plan_id: enterprisePlan._id, entitlement_key: 'limits.models_local', value: 'unlimited' },
      { plan_id: enterprisePlan._id, entitlement_key: 'compare_model_limit', value: 5 },
      { plan_id: enterprisePlan._id, entitlement_key: 'limits.models_api', value: 'unlimited' },
      { plan_id: enterprisePlan._id, entitlement_key: 'limits.users_max', value: 'unlimited' },
      
      // Resources
      { plan_id: enterprisePlan._id, entitlement_key: 'models.local.allowed', value: ['all'] },
      { plan_id: enterprisePlan._id, entitlement_key: 'models.api.allowed', value: ['all'] },
      { plan_id: enterprisePlan._id, entitlement_key: 'web.search.providers', value: ['all'] },
      { plan_id: enterprisePlan._id, entitlement_key: 'file.types.allowed', value: ['all'] },
      
      // Deployment
      { plan_id: enterprisePlan._id, entitlement_key: 'deployment.mode', value: 'hybrid' },
      { plan_id: enterprisePlan._id, entitlement_key: 'deployment.offline_cache_ttl_hours', value: 168 },
      { plan_id: enterprisePlan._id, entitlement_key: 'deployment.client_hosting_enabled', value: true },
      
      // Support
      { plan_id: enterprisePlan._id, entitlement_key: 'support.level', value: 'dedicated' },
    ];

    // Combine all entitlements
    const allEntitlements = [
      ...freeEntitlements,
      ...proEntitlements,
      ...businessEntitlements,
      ...enterpriseEntitlements,
    ];

    console.log('\n📊 Inserting plan entitlements...');
    const result = await PlanEntitlement.insertMany(allEntitlements);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully inserted: ${result.length} entitlements`);
    console.log(`   Free Plan: ${freeEntitlements.length} entitlements`);
    console.log(`   Pro Plan: ${proEntitlements.length} entitlements`);
    console.log(`   Business Plan: ${businessEntitlements.length} entitlements`);
    console.log(`   Enterprise Plan: ${enterpriseEntitlements.length} entitlements`);
    console.log('='.repeat(60));

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Test user registration');
    console.log('   2. Test user login (should return entitlement snapshot)');
    console.log('   3. Test arena mode access (Pro+ only)');
    
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
seedPlanEntitlements();
