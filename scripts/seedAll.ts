/**
 * Master Seeder Script
 * Purpose: Run all seeders in correct order
 * Usage: npx ts-node scripts/seedAll.ts
 */

import { execSync } from 'child_process';
import path from 'path';

const seeders = [
  {
    name: 'Entitlement Definitions',
    script: 'seedEntitlementDefinitions.ts',
    description: 'Master list of all entitlements',
  },
  {
    name: 'Subscription Plans',
    script: 'seedSubscriptionPlans.ts',
    description: 'Free, Pro, Business, Enterprise plans',
  },
  {
    name: 'Plan Entitlements',
    script: 'seedPlanEntitlements.ts',
    description: 'Map plans to entitlements',
  },
  {
    name: 'MCP Marketplace Connectors',
    script: 'seedMcpConnectors.ts',
    description: 'Seed initial marketplace tools (Google, Slack, GitHub)',
  },
];

async function runSeeder(seeder: typeof seeders[0]) {
  console.log('\n' + '='.repeat(70));
  console.log(`🚀 Running: ${seeder.name}`);
  console.log(`📝 ${seeder.description}`);
  console.log('='.repeat(70));

  try {
    const scriptPath = path.join(__dirname, seeder.script);
    execSync(`npx ts-node ${scriptPath}`, { stdio: 'inherit' });
    console.log(`✅ ${seeder.name} completed successfully!`);
    return true;
  } catch (error: any) {
    console.error(`❌ ${seeder.name} failed!`);
    console.error(error.message);
    return false;
  }
}

async function seedAll() {
  console.log('\n🌱 MASTER SEEDER - SOVEREIGN AI');
  console.log('Running all seeders in sequence...\n');

  const startTime = Date.now();
  let successCount = 0;
  let failedCount = 0;

  for (const seeder of seeders) {
    const success = await runSeeder(seeder);
    if (success) {
      successCount++;
    } else {
      failedCount++;
      console.log('\n⚠️  Seeder failed! Stopping execution.');
      break;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successful: ${successCount}/${seeders.length}`);
  console.log(`❌ Failed: ${failedCount}/${seeders.length}`);
  console.log(`⏱️  Total time: ${duration}s`);
  console.log('='.repeat(70));

  if (successCount === seeders.length) {
    console.log('\n🎉 ALL SEEDERS COMPLETED SUCCESSFULLY!');
    console.log('\n📝 Database is now ready. Next steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Test user registration: POST /api/auth/register');
    console.log('   3. Test user login: POST /api/auth/login');
    console.log('   4. Verify entitlement snapshot is returned');
    console.log('\n✨ Happy coding!');
  } else {
    console.log('\n⚠️  Some seeders failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run master seeder
seedAll();
