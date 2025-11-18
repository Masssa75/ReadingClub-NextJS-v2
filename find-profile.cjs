#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findProfile() {
    const { data, error } = await supabase
        .from('calibrations')
        .select('profile_id, letter, updated_at, pattern_data')
        .ilike('profile_id', '69420205%')
        .limit(30);

    if (error) throw error;

    console.log(`Found ${data.length} calibrations for profile starting with 69420205:\n`);
    
    data.forEach(cal => {
        const totalScore = cal.pattern_data?.snapshots?.reduce((sum, s) => sum + (s.score || 0), 0) || 0;
        const marker = totalScore > 0 ? '✅' : '  ';
        console.log(`${marker} ${cal.letter}: score=${totalScore}, updated=${cal.updated_at}`);
    });
}

findProfile();
