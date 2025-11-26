import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRSnapshot() {
  // Get all calibrations for letter 'r'
  const { data, error } = await supabase
    .from('calibrations')
    .select('*')
    .ilike('letter', 'r')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n📊 Found ${data.length} calibration(s) for letter 'r':\n`);

  data.forEach((cal, idx) => {
    console.log(`--- Calibration ${idx + 1} ---`);
    console.log(`Profile ID: ${cal.profile_id}`);
    console.log(`Letter: ${cal.letter}`);
    console.log(`Created: ${cal.created_at}`);
    console.log(`Updated: ${cal.updated_at}`);

    const snapshots = cal.pattern_data?.snapshots || [];
    console.log(`Snapshots: ${snapshots.length}`);

    snapshots.forEach((snap, i) => {
      const hasAudio = snap.audio_url ? '✅ HAS AUDIO' : '❌ NO AUDIO';
      const isNeg = snap.isNegative ? 'NEGATIVE' : 'POSITIVE';
      console.log(`  ${i + 1}. ${isNeg} - Score: ${snap.score || 1} - ${hasAudio}`);
      if (snap.audio_url) {
        console.log(`     Audio: ${snap.audio_url.substring(0, 80)}...`);
      }
      console.log(`     Created: ${snap.createdAt || 'N/A'}`);
    });
    console.log('');
  });

  // Show most recent snapshot with audio
  const allSnapshots = data.flatMap(cal =>
    (cal.pattern_data?.snapshots || []).map(s => ({
      ...s,
      profile: cal.profile_id,
      letter: cal.letter
    }))
  );

  const withAudio = allSnapshots.filter(s => s.audio_url);
  const mostRecent = withAudio.sort((a, b) =>
    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )[0];

  if (mostRecent) {
    console.log('🎉 Most recent snapshot with audio:');
    console.log(`   Letter: ${mostRecent.letter}`);
    console.log(`   Created: ${mostRecent.createdAt}`);
    console.log(`   Type: ${mostRecent.isNegative ? 'NEGATIVE' : 'POSITIVE'}`);
    console.log(`   Audio: ${mostRecent.audio_url}`);
  }
}

checkRSnapshot();
