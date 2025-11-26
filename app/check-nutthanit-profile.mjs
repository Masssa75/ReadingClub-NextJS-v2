import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkNutthanitProfile() {
  const profileId = '66d6b344-7766-45ba-b794-726fb296cf0d';

  console.log(`\n📊 Checking all calibrations for Nutthanit profile (${profileId}):\n`);

  const { data, error } = await supabase
    .from('calibrations')
    .select('*')
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${data.length} calibrations:\n`);

  data.forEach((cal) => {
    const snapshots = cal.pattern_data?.snapshots || [];
    const withAudio = snapshots.filter(s => s.audio_url).length;

    console.log(`Letter: ${cal.letter}`);
    console.log(`  Snapshots: ${snapshots.length} total, ${withAudio} with audio`);
    console.log(`  Updated: ${cal.updated_at}`);

    if (cal.letter.toLowerCase() === 'r') {
      console.log(`  ⭐ THIS IS 'R' - Details:`);
      snapshots.forEach((s, i) => {
        console.log(`    ${i+1}. ${s.isNegative ? 'NEG' : 'POS'} - Audio: ${s.audio_url ? 'YES ✅' : 'NO ❌'}`);
        console.log(`       Created: ${s.createdAt || 'N/A'}`);
        if (s.audio_url) {
          console.log(`       URL: ${s.audio_url.substring(0, 100)}...`);
        }
      });
    }
    console.log('');
  });
}

checkNutthanitProfile();
