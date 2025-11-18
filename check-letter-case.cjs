#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLetterCase() {
    try {
        const { data, error } = await supabase
            .from('calibrations')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const profile69 = data.filter(cal => cal.profile_id.startsWith('69420205'));
        
        console.log('Profile 69420205 - checking letter case and scores:\n');
        
        profile69.forEach(cal => {
            const totalScore = cal.pattern_data?.snapshots?.reduce((sum, s) => sum + (s.score || 0), 0) || 0;
            const isLowerCase = cal.letter === cal.letter.toLowerCase();
            const isUpperCase = cal.letter === cal.letter.toUpperCase();
            const caseType = isLowerCase ? 'lowercase' : 'UPPERCASE';
            const marker = totalScore > 0 ? '✅' : '  ';
            
            console.log(`${marker} "${cal.letter}" (${caseType}): score=${totalScore}, updated=${cal.updated_at}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkLetterCase();
