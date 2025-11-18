#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentScores() {
    try {
        // Get calibrations with scores > 0
        const { data, error } = await supabase
            .from('calibrations')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        console.log('🔍 Calibrations with scores > 0:\n');

        let foundScores = false;
        data.forEach(cal => {
            if (!cal.pattern_data || !cal.pattern_data.snapshots) return;
            
            const hasScore = cal.pattern_data.snapshots.some(s => s.score > 0);
            if (hasScore) {
                foundScores = true;
                const scores = cal.pattern_data.snapshots.filter(s => s.score > 0);
                console.log(`✅ ${cal.profile_id.substring(0, 8)}/${cal.letter}:`);
                console.log(`   Updated: ${cal.updated_at}`);
                console.log(`   Scores: ${scores.map(s => `${s.score} (${s.isNegative ? 'NEG' : 'POS'})`).join(', ')}`);
                console.log('');
            }
        });

        if (!foundScores) {
            console.log('❌ No calibrations with scores > 0 found!');
        }

        // Check specifically for profile 69420205
        console.log('\n🔍 Checking profile 69420205 specifically:\n');
        const profile = '69420205-27d0-4d14-a58c-eaf8db3d6086';
        const { data: profileData } = await supabase
            .from('calibrations')
            .select('*')
            .eq('profile_id', profile)
            .order('updated_at', { ascending: false });

        if (profileData) {
            profileData.forEach(cal => {
                const totalScore = cal.pattern_data?.snapshots?.reduce((sum, s) => sum + (s.score || 0), 0) || 0;
                console.log(`${cal.letter}: updated ${cal.updated_at}, total score: ${totalScore}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkRecentScores();
