#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProfile() {
    const profile = '69420205-27d0-4d14-a58c-eaf8db3d6086';
    
    const { data, error } = await supabase
        .from('calibrations')
        .select('*')
        .eq('profile_id', profile)
        .order('letter', { ascending: true });

    if (error) throw error;

    console.log('Profile 69420205 calibrations:\n');
    data.forEach(cal => {
        const snapshots = cal.pattern_data?.snapshots || [];
        const totalScore = snapshots.reduce((sum, s) => sum + (s.score || 0), 0);
        const updated = new Date(cal.updated_at).toISOString();
        
        if (totalScore > 0) {
            console.log(`✅ ${cal.letter}: score=${totalScore}, updated=${updated}`);
        } else {
            console.log(`   ${cal.letter}: score=0, updated=${updated}`);
        }
    });
}

checkProfile();
