const fs = require('fs');
const path = require('path');

// Exclusively load from canonical server/.env
require('./services/loadEnv');

const {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  testSupabaseConnection
} = require('./services/supabaseClient');

async function runDiagnostic() {
  console.log('===========================================================');
  console.log('       SUPABASE POSTGRESQL CONNECTIVITY DIAGNOSTIC         ');
  console.log('===========================================================');

  const configStatus = getSupabaseConfigStatus();

  if (!configStatus.configured) {
    console.log(`\n[STATUS] Supabase is NOT yet configured in server/.env`);
    console.log(`[REASON] ${configStatus.reason}`);
    console.log(`\nDetected Project URL: ${process.env.SUPABASE_URL || 'Not configured'}`);
    console.log(`Secret Key Status:    ${(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? '(Placeholder detected in server/.env)' : '(Missing)'}`);

    console.log('\n--- HOW TO CONFIGURE YOUR KEY ---');
    console.log('1. Open your Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm');
    console.log('2. Click Project Settings (gear icon) -> "API Keys" (or "API").');
    console.log('3. Copy your Secret API Key (sb_secret_...) or service_role key.');
    console.log('4. Open server/.env and set:');
    console.log('     SUPABASE_URL=https://scfshbwfeoehjhwhwozm.supabase.co');
    console.log('     SUPABASE_SECRET_KEY=sb_secret_...');
    console.log('5. Re-run: npm run test:supabase\n');
    console.log('[NOTE] In the meantime, the application operates safely in Local Mode');
    console.log('       using server/data/db.json without downtime or crashes.\n');
    process.exit(0);
  }

  // Configuration detected
  console.log('\n[INFO] Supabase Configuration Detected:');
  console.log(`  Project URL: ${configStatus.url}`);
  console.log(`  Key Format:  ${configStatus.keyType}`);
  console.log(`  Key Value:   [PROTECTED - NEVER PRINTED TO CONSOLE]`);

  console.log('\nTesting database connectivity with Supabase API...');
  const connResult = await testSupabaseConnection();

  if (!connResult.success && !connResult.schemaPending) {
    console.error(`\n[ERROR] Connection failed: ${connResult.message}`);

    if (
      connResult.message.includes('Invalid API key') ||
      connResult.status === 401 ||
      (connResult.code && connResult.code.toString() === '401')
    ) {
      console.error('\n[DIAGNOSTIC] Supabase API rejected the configured key (HTTP 401 Unauthorized).');
      console.error('Possible causes:');
      console.error('1. The key was truncated, had a typo, or was copied incompletely.');
      console.error('2. The key belongs to another Supabase project rather than scfshbwfeoehjhwhwozm.');
      console.error('3. The key was rotated, deleted, or regenerated in the Supabase Dashboard.');
      console.error('\nTo update with your active Secret Key:');
      console.error('1. Open: https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm/settings/api');
      console.error('2. Under "API Keys" / "Secret keys", click Reveal and copy your Secret Key.');
      console.error('3. In "server/.env", set:');
      console.error('   SUPABASE_SECRET_KEY=<paste_your_active_secret_key_here>');
      console.error('4. Re-run: npm run test:supabase\n');
    } else {
      console.error('Please verify your network connection and project status at:');
      console.error('https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm\n');
    }
    process.exit(1);
  }

  // If authenticated but schema tables are not yet created in PostgreSQL
  if (connResult.schemaPending) {
    console.log('\n[PASS] Authentication successful! Supabase accepted your Secret Key.');
    console.log('\n===========================================================');
    console.log(' [ACTION REQUIRED] PostgreSQL Database Tables Not Found    ');
    console.log('===========================================================');
    console.log('Your project is authenticated, but the required tables do not exist yet.');
    console.log('To create the tables in your Supabase database:');
    console.log('1. Open the Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm/sql/new');
    console.log('2. Open "server/supabase_schema.sql" in this project and copy all lines.');
    console.log('3. Paste the SQL script into the Supabase SQL Editor and click RUN.');
    console.log('4. Re-run: npm run test:supabase\n');
    process.exit(0);
  }

  console.log('[PASS] Connected successfully to Supabase PostgreSQL database!');

  console.log('\nChecking all 7 required application tables:');
  const tables = [
    { name: 'colleges', label: 'Colleges Table' },
    { name: 'users', label: 'Users Table' },
    { name: 'complaints', label: 'Complaints Table' },
    { name: 'activity_logs', label: 'Activity Logs / Audit Trail' },
    { name: 'comments', label: 'Comments / Discussion' },
    { name: 'reports', label: 'Misuse Reports' },
    { name: 'notifications', label: 'Notifications Table' }
  ];

  let allOk = true;
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t.name).select('id', { count: 'exact' });
      if (error) {
        console.log(`  [FAIL] ${t.label} (${t.name}): ${error.message}`);
        allOk = false;
      } else {
        console.log(`  [PASS] ${t.label} (${t.name}): Active (${data ? data.length : 0} rows found)`);
      }
    } catch (e) {
      console.log(`  [FAIL] ${t.label} (${t.name}): ${e.message}`);
      allOk = false;
    }
  }

  // Storage bucket check
  console.log('\nChecking Storage Bucket:');
  try {
    const { data: buckets, error: bError } = await supabase.storage.listBuckets();
    if (bError) {
      console.log(`  [WARN] Storage bucket check: ${bError.message}`);
    } else {
      const hasBucket = buckets && buckets.some(b => b.name === 'complaint-evidence');
      if (hasBucket) {
        console.log('  [PASS] Storage bucket "complaint-evidence" is active.');
      } else {
        console.log('  [INFO] Storage bucket "complaint-evidence" not yet initialized (local /uploads fallback active).');
      }
    }
  } catch (e) {
    console.log(`  [INFO] Storage check skipped: ${e.message}`);
  }

  if (allOk) {
    console.log('\n===========================================================');
    console.log(' [SUCCESS] Supabase PostgreSQL cloud backend is 100% READY! ');
    console.log('===========================================================\n');
  } else {
    console.log('\n[WARNING] Some tables are missing. Please open the Supabase SQL Editor,');
    console.log('paste the contents of "server/supabase_schema.sql", and click RUN.\n');
  }
}

runDiagnostic();
