import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rnuakaobwhxxhnpbxklz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudWFrYW9id2h4eGhucGJ4a2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEwOTYwMDgsImV4cCI6MjA0NjY3MjAwOH0.cnKCJex2Ru94wDm9c0BEaGpEzqtwFWG5vAU8u4nvGcQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScores() {
  const { data, error } = await supabase
    .from('calibrations')
    .select('letter, pattern_data, updated_at')
    .order('letter');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Snapshot Scores by Letter ===\n');

  data.forEach(cal => {
    const snapshots = cal.pattern_data?.snapshots || [];
    const scores = snapshots.map(s => s.score || 0);
    const hasScores = scores.some(s => s > 0);
    const totalScore = scores.reduce((a, b) => a + b, 0);

    console.log(`Letter ${cal.letter.toUpperCase()}:`);
    console.log(`  Snapshots: ${snapshots.length}`);
    console.log(`  Scores: [${scores.join(', ')}]`);
    console.log(`  Total: ${totalScore}`);
    console.log(`  Has scores: ${hasScores ? '✅' : '❌'}`);
    console.log(`  Updated: ${new Date(cal.updated_at).toLocaleTimeString()}`);
    console.log('');
  });
}

checkScores();
