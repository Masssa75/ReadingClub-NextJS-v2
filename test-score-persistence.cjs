#!/usr/bin/env node

// Test script to check if snapshot scores are being saved to database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkScorePersistence() {
    console.log('🔍 Checking snapshot score persistence...\n');

    try {
        // Get all calibrations
        const { data, error } = await supabase
            .from('calibrations')
            .select('*')
            .order('profile_id', { ascending: true })
            .order('letter', { ascending: true });

        if (error) throw error;

        let totalSnapshots = 0;
        let snapshotsWithScores = 0;
        let totalScore = 0;

        console.log(`Found ${data.length} calibration records\n`);

        data.forEach(cal => {
            if (!cal.pattern_data || !cal.pattern_data.snapshots) {
                console.log(`⚠️  ${cal.profile_id.substring(0, 8)}/${cal.letter}: Old format (no snapshots array)`);
                return;
            }

            const snapshots = cal.pattern_data.snapshots;
            const scoresInRecord = snapshots.map(s => s.score || 0);
            const maxScore = Math.max(...scoresInRecord);
            const totalInRecord = scoresInRecord.reduce((a, b) => a + b, 0);

            totalSnapshots += snapshots.length;
            snapshotsWithScores += snapshots.filter(s => s.score > 0).length;
            totalScore += totalInRecord;

            if (maxScore > 0) {
                console.log(`✅ ${cal.profile_id.substring(0, 8)}/${cal.letter}: ${snapshots.length} snapshots, max score: ${maxScore}, total: ${totalInRecord}`);
                snapshots.forEach((s, i) => {
                    if (s.score > 0) {
                        console.log(`   Snapshot ${i+1}: score=${s.score}, isNegative=${s.isNegative}, profile=${s.profileId?.substring(0, 8)}`);
                    }
                });
            } else {
                console.log(`   ${cal.profile_id.substring(0, 8)}/${cal.letter}: ${snapshots.length} snapshots, all with score=0`);
            }
        });

        console.log(`\n📊 Summary:`);
        console.log(`   Total snapshots: ${totalSnapshots}`);
        console.log(`   Snapshots with score > 0: ${snapshotsWithScores}`);
        console.log(`   Total score across all snapshots: ${totalScore}`);
        console.log(`   Average score per scored snapshot: ${snapshotsWithScores > 0 ? (totalScore / snapshotsWithScores).toFixed(2) : 0}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkScorePersistence();
