/**
 * Seed Script: Entitlement Definitions
 * Purpose: Populate EntitlementDefinition collection with all system entitlements
 * Usage: npx ts-node scripts/seedEntitlementDefinitions.ts
 */


import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import EntitlementDefinition from '../src/models/EntitlementDefinition.model';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const ENTITLEMENT_DEFINITIONS = [
  // ===============================
  // CAPABILITIES (Boolean features)
  // ===============================
  {
    key: "features.compare_mode",
    type: "boolean",
    category: "capabilities",
    description: "Compare mode for model comparison",
    default_value: false,
    validation_rules: null,
  },
  {
    key: "features.client_mode",
    type: "boolean",
    category: "capabilities",
    description: "Client hosting mode (multi-user)",
    default_value: false,
    validation_rules: null,
  },
  {
    key: "features.file_upload",
    type: "boolean",
    category: "capabilities",
    description: "File upload feature",
    default_value: true,
    validation_rules: null,
  },
  {
    key: "features.prompt_manager",
    type: "boolean",
    category: "capabilities",
    description: "Prompt library manager",
    default_value: true,
    validation_rules: null,
  },
  {
    key: "features.web_search",
    type: "boolean",
    category: "capabilities",
    description: "Web search integration",
    default_value: true,
    validation_rules: null,
  },
  {
    key: "support.level",
    type: "string",
    category: "capabilities",
    description: "Support tier",
    default_value: "community",
    validation_rules: { enum: ["community", "email", "priority", "dedicated"] },
  },
  
  // ===============================
  // LIMITS (Numeric limits or "unlimited")
  // ===============================
  {
    key: "limits.file_uploads_per_day",
    type: "number",
    category: "limits",
    description: "Max file uploads per day",
    default_value: 5,
    validation_rules: { min: 0 },
  },
  {
    key: "limits.file_size_mb",
    type: "number",
    category: "limits",
    description: "Max file size in MB",
    default_value: 10,
    validation_rules: { min: 1, max: 100 },
  },
  {
    key: "limits.prompts_saved",
    type: "number",
    category: "limits",
    description: "Max saved prompts",
    default_value: 5,
    validation_rules: { min: 1 },
  },
  {
    key: "limits.models_local",
    type: "number",
    category: "limits",
    description: "Max local models",
    default_value: 1,
    validation_rules: { min: 1 },
  },
  {    key: "compare_model_limit",
    type: "number",
    category: "limits",
    description: "Max compare model limit at time",
    default_value: 3,
    validation_rules: { min: 2, max: 5 },
  },
  {    key: "limits.models_api",
    type: "number",
    category: "limits",
    description: "Max API models",
    default_value: 1,
    validation_rules: { min: 1 },
  },
  {
    key: "limits.users_max",
    type: "number",
    category: "limits",
    description: "Max users/seats",
    default_value: 1,
    validation_rules: { min: 1 },
  },
  
  // ===============================
  // RESOURCES (Arrays - whitelists)
  // ===============================
  {
    key: "models.local.allowed",
    type: "array",
    category: "resources",
    description: "Allowed local model providers",
    default_value: ["Any"],
    validation_rules: null,
  },
  {
    key: "models.api.allowed",
    type: "array",
    category: "resources",
    description: "Allowed API providers",
    default_value: ["openai"],
    validation_rules: { enum: ["openai", "google", "anthropic", "azure-openai", "perplexity"] },
  },
  {
    key: "web.search.providers",
    type: "array",
    category: "resources",
    description: "Allowed search providers",
    default_value: ["duckduckgo"],
    validation_rules: { enum: ["duckduckgo", "google", "bing"] },
  },
  {
    key: "file.types.allowed",
    type: "array",
    category: "resources",
    description: "Allowed file types",
    default_value: ["xlsx", "txt", "docx"],
    validation_rules: { enum: ["xlsx", "txt", "docx", "pdf", "csv"] },
  },
  
  // ===============================
  // DEPLOYMENT (Configuration)
  // ===============================
  {
    key: "deployment.mode",
    type: "string",
    category: "deployment",
    description: "Deployment mode",
    default_value: "hybrid",
    validation_rules: { enum: ["cloud", "hybrid", "local"] },
  },
  {
    key: "deployment.offline_cache_ttl_hours",
    type: "number",
    category: "deployment",
    description: "Offline cache validity hours",
    default_value: 24,
    validation_rules: { min: 1, max: 720 },
  },
  {
    key: "deployment.client_hosting_enabled",
    type: "boolean",
    category: "deployment",
    description: "Can host for other users",
    default_value: false,
    validation_rules: null,
  },
  {
    key: "deployment.local_enforcement",
    type: "boolean",
    category: "deployment",
    description: "Enforce entitlements locally without server validation",
    default_value: true,
    validation_rules: null,
  },
];

async function seedEntitlementDefinitions() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    if (!process.env.AZURE_COSMOS_CONNECTIONSTRING) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    await mongoose.connect(process.env.AZURE_COSMOS_CONNECTIONSTRING);
    console.log('✅ Connected to MongoDB');

    console.log('\n📋 Starting Entitlement Definitions Seeding...');
    console.log(`📊 Total definitions to seed: ${ENTITLEMENT_DEFINITIONS.length}`);

    // Check existing definitions
    const existingCount = await EntitlementDefinition.countDocuments();
    console.log(`📦 Existing definitions in database: ${existingCount}`);

    if (existingCount > 0) {
      console.log('\n⚠️  Database already contains entitlement definitions.');
      console.log('Options:');
      console.log('  1. Keep existing and add new ones (skip duplicates)');
      console.log('  2. Clear all and reseed from scratch');
      console.log('\nDefaulting to option 1 (safe mode)...\n');
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const definition of ENTITLEMENT_DEFINITIONS) {
      try {
        // Check if definition already exists
        const existing = await EntitlementDefinition.findOne({ key: definition.key });
        
        if (existing) {
          console.log(`⏭️  Skipped: ${definition.key} (already exists)`);
          skipped++;
        } else {
          await EntitlementDefinition.create(definition);
          console.log(`✅ Inserted: ${definition.key}`);
          inserted++;
        }
      } catch (error: any) {
        console.error(`❌ Error inserting ${definition.key}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully inserted: ${inserted}`);
    console.log(`⏭️  Skipped (duplicates): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total in database now: ${await EntitlementDefinition.countDocuments()}`);
    console.log('='.repeat(60));

    // Show breakdown by category
    console.log('\n📑 BREAKDOWN BY CATEGORY:');
    const categories = ['capabilities', 'limits', 'resources', 'deployment', 'support'];
    for (const category of categories) {
      const count = await EntitlementDefinition.countDocuments({ category });
      console.log(`  ${category.toUpperCase()}: ${count} definitions`);
    }

    console.log('\n✨ Seeding completed successfully!');
    
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
seedEntitlementDefinitions();
