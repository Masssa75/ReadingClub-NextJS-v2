require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function convertToLowercase() {
  console.log('Converting all calibration letters to lowercase...\n');

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

  // Get all calibrations for this profile
  const { data: calibrations, error: fetchError } = await supabase
    .from('calibrations')
    .select('*')
    .eq('profile_id', profileId);

  if (fetchError) {
    console.error('Error fetching calibrations:', fetchError);
    return;
  }

  console.log(`\nFound ${calibrations.length} calibrations to convert\n`);

  // Update each calibration with lowercase letter
  for (const cal of calibrations) {
    const uppercaseLetter = cal.letter;
    const lowercaseLetter = uppercaseLetter.toLowerCase();

    if (uppercaseLetter === lowercaseLetter) {
      console.log(`  ✓ ${cal.letter} - already lowercase`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('calibrations')
      .update({ letter: lowercaseLetter })
      .eq('id', cal.id);

    if (updateError) {
      console.error(`  ✗ ${uppercaseLetter} → ${lowercaseLetter} - ERROR:`, updateError.message);
    } else {
      console.log(`  ✓ ${uppercaseLetter} → ${lowercaseLetter}`);
    }
  }

  console.log('\n✅ Conversion complete!');
  console.log('\n📝 Refresh the page to see lowercase letters');
}

convertToLowercase();
