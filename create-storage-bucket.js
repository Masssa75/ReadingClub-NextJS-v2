// Create Supabase storage bucket for calibration audio
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eyrcioeihiaisjwnalkz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cmNpb2VpaGlhaXNqd25hbGt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTIyNjI2OCwiZXhwIjoyMDQ2ODAyMjY4fQ.jLJxpfvNPWuajEHG_MWN6rFU20dWALRBlQlShLrAmuo'; // From .env

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createBucket() {
    console.log('Creating calibration_audio bucket...');

    const { data, error } = await supabase.storage.createBucket('calibration_audio', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['audio/webm', 'audio/wav', 'audio/mp3']
    });

    if (error) {
        if (error.message.includes('already exists')) {
            console.log('✅ Bucket already exists!');
        } else {
            console.error('❌ Error creating bucket:', error);
        }
    } else {
        console.log('✅ Bucket created successfully:', data);
    }
}

createBucket();
