require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  `https://eyrcioeihiaisjwnalkz.supabase.co`,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const migrationSQL = `
ALTER TABLE calibrations
ADD COLUMN IF NOT EXISTS proficiency INTEGER DEFAULT 0 CHECK (proficiency >= 0 AND proficiency <= 3);

CREATE INDEX IF NOT EXISTS idx_calibrations_proficiency
ON calibrations(profile_id, proficiency);

CREATE INDEX IF NOT EXISTS idx_calibrations_letter_proficiency
ON calibrations(profile_id, letter, proficiency);

UPDATE calibrations
SET proficiency = 0
WHERE proficiency IS NULL;
`;

async function applyMigration() {
  console.log('🔄 Applying proficiency migration...');

  const { data, error } = await supabase.rpc('exec', { sql: migrationSQL });

  if (error) {
    console.error('❌ Error:', error);

    // Try alternative method: split into individual statements
    console.log('\n🔄 Trying alternative method...');
    const statements = migrationSQL.split(';').filter(s => s.trim());

    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      console.log(`Executing: ${stmt.substring(0, 50)}...`);
      const result = await supabase.rpc('exec', { sql: stmt });
      if (result.error) {
        console.error(`Error: ${result.error.message}`);
      } else {
        console.log('✓ Success');
      }
    }
  } else {
    console.log('✅ Migration applied successfully!');
    console.log(data);
  }

  // Verify column exists
  console.log('\n🔍 Verifying proficiency column...');
  const { data: testData, error: testError } = await supabase
    .from('calibrations')
    .select('proficiency')
    .limit(1);

  if (testError) {
    console.error('❌ Verification failed:', testError.message);
  } else {
    console.log('✅ Proficiency column exists and is queryable!');
  }
}

applyMigration().catch(console.error);
