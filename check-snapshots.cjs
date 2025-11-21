const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('calibrations')
    .select('letter, pattern_data, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent calibrations with snapshots:\n');
  data.forEach(cal => {
    const snapshots = cal.pattern_data?.snapshots || [];
    const positive = snapshots.filter(s => !s.isNegative);
    const negative = snapshots.filter(s => s.isNegative);
    const withAudio = snapshots.filter(s => s.audio_url);

    console.log(`Letter ${cal.letter}: ${positive.length} positive, ${negative.length} negative, ${withAudio.length} with audio`);
    console.log(`  Updated: ${cal.updated_at}`);

    // Show audio URLs if any
    if (withAudio.length > 0) {
      withAudio.forEach((s, i) => {
        const url = s.audio_url || 'none';
        const urlPreview = url.substring(url.lastIndexOf('/') + 1);
        console.log(`  [${s.isNegative ? 'NEG' : 'POS'}] ${urlPreview} (score: ${s.score})`);
      });
    }
  });
})();
