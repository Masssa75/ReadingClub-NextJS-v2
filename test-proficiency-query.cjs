require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://eyrcioeihiaisjwnalkz.supabase.co',
  process.env.SUPABASE_ANON_KEY
);

async function testProficiencyQuery() {
  console.log('🔍 Testing proficiency column access...\n');

  // Test 1: Can we select proficiency from calibrations?
  console.log('Test 1: Select proficiency column');
  const { data: test1, error: error1 } = await supabase
    .from('calibrations')
    .select('proficiency')
    .limit(1);

  if (error1) {
    console.log('❌ Error:', error1.message);
    console.log('   Code:', error1.code);
    console.log('   Details:', error1.details);
    console.log('   Hint:', error1.hint);
  } else {
    console.log('✅ Success! Proficiency column is accessible');
    console.log('   Data:', test1);
  }

  // Test 2: The exact query the code uses
  console.log('\nTest 2: Exact query from code (profile + letter filter)');
  const { data: test2, error: error2 } = await supabase
    .from('calibrations')
    .select('proficiency')
    .eq('profile_id', 'cb206f3b-bb13-47dd-8fc8-dcf49aeb8ff9')
    .eq('letter', 'a');

  if (error2) {
    console.log('❌ Error:', error2.message);
    console.log('   Code:', error2.code);
    console.log('   Details:', error2.details);
  } else {
    console.log('✅ Success!');
    console.log('   Data:', test2);
  }

  // Test 3: Check database schema
  console.log('\nTest 3: Check if column exists in schema');
  const { data: test3, error: error3 } = await supabase
    .from('calibrations')
    .select('*')
    .limit(1);

  if (error3) {
    console.log('❌ Error:', error3.message);
  } else {
    console.log('✅ Calibration record structure:');
    if (test3 && test3.length > 0) {
      console.log('   Columns:', Object.keys(test3[0]));
      console.log('   Has proficiency?', 'proficiency' in test3[0]);
    } else {
      console.log('   No records found');
    }
  }
}

testProficiencyQuery().catch(console.error);
