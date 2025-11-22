import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function deleteUSnapshots() {
  console.log('\n🗑️  Deleting all snapshots for letter "u" (both uppercase and lowercase)...\n');

  // Get all calibrations for letter 'u'
  const { data: calibrations, error: fetchError } = await supabase
    .from('calibrations')
    .select('*')
    .or('letter.ilike.u,letter.ilike.U');

  if (fetchError) {
    console.error('❌ Error fetching calibrations:', fetchError);
    return;
  }

  console.log(`Found ${calibrations.length} calibration record(s) for letter 'u':`);

  for (const cal of calibrations) {
    const snapshots = cal.pattern_data?.snapshots || [];
    console.log(`\n- Letter: ${cal.letter}`);
    console.log(`  Profile: ${cal.profile_id}`);
    console.log(`  Snapshots: ${snapshots.length}`);

    // Clear all snapshots
    const { error: updateError } = await supabase
      .from('calibrations')
      .update({
        pattern_data: { snapshots: [] },
        updated_at: new Date().toISOString()
      })
      .eq('id', cal.id);

    if (updateError) {
      console.error(`  ❌ Error updating:`, updateError);
    } else {
      console.log(`  ✅ Deleted ${snapshots.length} snapshots`);
    }
  }

  console.log('\n✅ All "u" snapshots deleted!\n');
}

deleteUSnapshots();
