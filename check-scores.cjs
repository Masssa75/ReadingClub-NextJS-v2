const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eyrcioeihiaisjwnalkz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cmNpb2VpaGlhaXNqd25hbGt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc0ODQwNSwiZXhwIjoyMDc4MzI0NDA1fQ.qGHXa1oxes8xYn8ryFYKhuoLVAzjPsZJWHz0TmvuUm4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScores() {
    console.log('🔍 Checking scores for letters o and p...\n');

    const letters = ['o', 'p'];

    for (const letter of letters) {
        console.log(`\n═══════════════════════════════════════`);
        console.log(`Letter: ${letter.toUpperCase()}`);
        console.log(`═══════════════════════════════════════`);

        const { data, error } = await supabase
            .from('calibrations')
            .select('*')
            .eq('letter', letter);

        if (error) {
            console.error(`❌ Error fetching ${letter}:`, error);
            continue;
        }

        if (!data || data.length === 0) {
            console.log(`No calibrations found for ${letter}`);
            continue;
        }

        console.log(`Found ${data.length} calibration(s)`);

        data.forEach((cal, idx) => {
            console.log(`\n--- Calibration ${idx + 1} ---`);
            console.log(`Profile ID: ${cal.profile_id.substring(0, 12)}...`);
            console.log(`Created: ${cal.created_at}`);
            console.log(`Updated: ${cal.updated_at}`);

            // Check pattern_data structure
            const pd = cal.pattern_data;

            if (pd.snapshots) {
                console.log(`\n📊 NEW FORMAT (snapshots):`);
                console.log(`  Total snapshots: ${pd.snapshots.length}`);

                const positive = pd.snapshots.filter(s => !s.isNegative);
                const negative = pd.snapshots.filter(s => s.isNegative);

                console.log(`  Positive: ${positive.length}`);
                console.log(`  Negative: ${negative.length}`);

                // Show scores
                console.log(`\n  Score breakdown:`);
                pd.snapshots.forEach((snap, i) => {
                    const type = snap.isNegative ? 'NEG' : 'POS';
                    const score = snap.score || 0;
                    const profileShort = snap.profileId?.substring(0, 8) || 'unknown';
                    console.log(`    [${i + 1}] ${type} - Score: ${score} (Profile: ${profileShort})`);
                });

                // Check if any have scores > 0
                const withScores = pd.snapshots.filter(s => (s.score || 0) > 0);
                if (withScores.length > 0) {
                    console.log(`\n  ✅ ${withScores.length} snapshot(s) have scores > 0`);
                } else {
                    console.log(`\n  ⚠️ All snapshots have score = 0`);
                }
            } else if (pd.pattern) {
                console.log(`\n📦 OLD FORMAT (pattern array):`);
                console.log(`  Patterns: ${pd.pattern.length}`);
                console.log(`  ⚠️ Needs migration to track scores`);
            } else {
                console.log(`\n❓ VERY OLD FORMAT (raw array)`);
                console.log(`  ⚠️ Needs migration to track scores`);
            }
        });
    }

    console.log(`\n═══════════════════════════════════════\n`);
}

checkScores().catch(console.error);
