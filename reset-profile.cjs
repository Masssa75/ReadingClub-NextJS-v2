require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetProfile() {
  // Get profile ID for 'm'
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('name', 'm')
    .single();

  if (profileError || !profiles) {
    console.log('Profile "m" not found:', profileError);
    return;
  }

  const profileId = profiles.id;
  console.log('Found profile:', profileId);

  // Reset all calibrations to proficiency 0 (UNKNOWN)
  const { data, error } = await supabase
    .from('calibrations')
    .update({ proficiency: 0 })
    .eq('profile_id', profileId)
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`✅ Reset ${data.length} letters to UNKNOWN`);
    data.forEach(cal => console.log(`  - ${cal.letter}: proficiency = 0`));
  }

  console.log('\n📝 Also clear browser localStorage:');
  console.log('Open devtools and run:');
  console.log('localStorage.clear(); location.reload();');
}

resetProfile();
