import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('📊 Checking profiles and calibrations...\n');

// Get all profiles
const { data: profiles, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .order('created_at', { ascending: false });

if (profileError) {
  console.error('Error fetching profiles:', profileError);
  process.exit(1);
}

console.log(`Found ${profiles.length} profiles:\n`);

// For each profile, check calibrations
for (const profile of profiles) {
  const { data: calibrations } = await supabase
    .from('calibrations')
    .select('letter')
    .eq('profile_id', profile.id);

  const calibratedLetters = calibrations?.map(c => c.letter).join(', ') || 'none';
  const isGuest = profile.user_id === null;

  console.log(`${isGuest ? '👤 Guest' : '👨 Named'}: ${profile.name}`);
  console.log(`   ID: ${profile.id}`);
  console.log(`   Calibrations: ${calibrations?.length || 0} letters ${calibrations?.length ? `(${calibratedLetters})` : ''}`);
  console.log(`   Created: ${new Date(profile.created_at).toLocaleString()}`);
  console.log('');
}

console.log('\n💡 The Candy Land game is currently using guest profile:');
console.log('   ID: e06793fb-7b31-4a38-81bc-e6da7447f8df4');
