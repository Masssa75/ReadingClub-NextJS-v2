import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetProfile() {
  // Get profile ID for 'm'
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('name', 'm')
    .single();

  if (!profiles) {
    console.log('Profile "m" not found');
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
    data.forEach(cal => console.log(`  - ${cal.letter}: UNKNOWN`));
  }

  // Clear localStorage session (you'll need to do this in browser)
  console.log('\n📝 Also clear localStorage in browser:');
  console.log('localStorage.removeItem("adaptiveSession");');
  console.log('localStorage.removeItem("session_' + profileId + '");');
}

resetProfile();
