#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findProfile() {
    try {
        const { data, error } = await supabase
            .from('calibrations')
            .select('profile_id, letter, updated_at, pattern_data')
            .ilike('profile_id', '69420205%')
            .order('updated_at', { ascending: false })
            .limit(30);

        if (error) throw error;

        console.log(`Found ${data.length} calibrations for profile starting with 69420205:\n`);
        
        data.forEach(cal => {
            const totalScore = cal.pattern_data?.snapshots?.reduce((sum, s) => sum + (s.score || 0), 0) || 0;
            const marker = totalScore > 0 ? '✅' : '  ';
            const time = new Date(cal.updated_at).toLocaleString();
            console.log(`${marker} ${cal.letter.padEnd(2)}: score=${totalScore.toString().padStart(2)}, ${time}`);
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

findProfile();
