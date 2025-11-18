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
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        const filtered = data.filter(cal => cal.profile_id.startsWith('69420205'));
        
        console.log(`Found ${filtered.length} calibrations for profile 69420205:\n`);
        
        filtered.forEach(cal => {
            const totalScore = cal.pattern_data?.snapshots?.reduce((sum, s) => sum + (s.score || 0), 0) || 0;
            const marker = totalScore > 0 ? '✅' : '  ';
            const time = new Date(cal.updated_at).toLocaleString();
            console.log(`${marker} ${cal.letter}: score=${totalScore}, ${time}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
}

findProfile();
