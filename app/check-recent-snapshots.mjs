import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRecentSnapshots() {
  // Get all calibrations, sorted by most recent update
  const { data, error } = await supabase
    .from('calibrations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n📊 Most recent 10 calibration updates:\n`);

  data.forEach((cal, idx) => {
    const snapshots = cal.pattern_data?.snapshots || [];
    const withAudio = snapshots.filter(s => s.audio_url).length;
    const totalSnaps = snapshots.length;

    console.log(`${idx + 1}. Letter: ${cal.letter} | Profile: ${cal.profile_id.substring(0, 8)}...`);
    console.log(`   Updated: ${cal.updated_at}`);
    console.log(`   Snapshots: ${totalSnaps} total, ${withAudio} with audio`);

    // Show most recent snapshot
    if (snapshots.length > 0) {
      const sorted = snapshots.sort((a, b) =>
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      const recent = sorted[0];
      console.log(`   Latest snapshot: ${recent.createdAt || 'N/A'} - ${recent.audio_url ? '✅ HAS AUDIO' : '❌ NO AUDIO'}`);
    }
    console.log('');
  });
}

checkRecentSnapshots();
