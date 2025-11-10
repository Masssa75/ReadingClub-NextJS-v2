# Supabase Setup Guide for Reading Club

## ✅ Completed

- [x] Supabase project created: **ReadingClub**
- [x] Project ID: `eyrcioeihiaisjwnalkz`
- [x] Region: Southeast Asia (Singapore) - Close to Thailand!
- [x] Organization: Masssa75's Org
- [x] Supabase client integrated into index-1.3.html
- [x] Code updated to use Supabase for calibration storage
- [x] Audio recording re-enabled

## 🔧 Setup Required (Due to Network Issue)

The migration file is ready at: `supabase/migrations/20251110043427_create_profiles_and_calibrations.sql`

The CLI can't connect due to IPv6/network routing. Here's how to complete setup:

### Option 1: Run Migration SQL Manually (Recommended)

Go to https://supabase.com/dashboard/project/eyrcioeihiaisjwnalkz/sql/new

Copy the ENTIRE content from `supabase/migrations/20251110043427_create_profiles_and_calibrations.sql` and click "Run".

This will:
- ✅ Create `profiles` and `calibrations` tables
- ✅ Add indexes for performance
- ✅ Enable Row Level Security (RLS)
- ✅ Create access policies (public for MVP)
- ✅ Create `calibration-audio` storage bucket (public)
- ✅ Set up storage policies for upload/read/update/delete

### Option 2: Management API (When CLI Has Network Issues)

When `supabase db push` fails with "no route to host" or IPv6 routing errors:

```bash
# Prerequisite: Management API token in .env
# Get from: https://supabase.com/dashboard/account/tokens
# Save as: SUPABASE_ACCESS_TOKEN=sbp_...

source .env

# Create JSON payload from migration file
cat supabase/migrations/YOUR_MIGRATION.sql | jq -Rs '{query: .}' > /tmp/migration.json

# Execute via Management API (replace PROJECT_REF with your project ID)
curl -X POST "https://api.supabase.com/v1/projects/PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/migration.json

# Verify tables were created:
curl "https://PROJECT_REF.supabase.co/rest/v1/profiles?limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Response: [] means table exists (empty but ready)
```

**Why This Works:**
- Uses HTTPS REST API (bypasses database network routing)
- Only needs API token (no direct DB connection)
- Same result as `supabase db push`

---

### Full Migration SQL (for reference):

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calibrations table
CREATE TABLE IF NOT EXISTS calibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    letter TEXT NOT NULL,
    pattern_data JSONB NOT NULL,
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, letter)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_calibrations_profile_id ON calibrations(profile_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_letter ON calibrations(letter);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now since no auth)
CREATE POLICY "Allow all operations on profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all operations on calibrations" ON calibrations FOR ALL USING (true);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('calibration-audio', 'calibration-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for calibration-audio bucket
CREATE POLICY "Public can upload audio"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'calibration-audio');

CREATE POLICY "Public can read audio"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'calibration-audio');

CREATE POLICY "Public can update audio"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'calibration-audio')
    WITH CHECK (bucket_id = 'calibration-audio');

CREATE POLICY "Public can delete audio"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'calibration-audio');
```

**That's it!** Running this single SQL migration creates everything you need.

## 🧪 Testing

Once the manual setup is complete:

1. Open index-1.3.html in your browser
2. Open browser console (F12)
3. Check for "✅ Supabase client initialized"
4. Try calibrating a letter (e.g., letter A)
5. Check console for:
   - "✅ Started audio recording for calibration"
   - "✅ Audio uploaded: [URL]"
   - "✅ Saved calibration for letter A"
6. Verify in Supabase dashboard:
   - Database: Check `profiles` and `calibrations` tables
   - Storage: Check `calibration-audio` bucket for audio files

## 📊 Project Credentials

**Project URL:** https://eyrcioeihiaisjwnalkz.supabase.co
**Dashboard:** https://supabase.com/dashboard/project/eyrcioeihiaisjwnalkz
**Region:** Southeast Asia (Singapore) 🇸🇬

**Anon Key (already in code):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cmNpb2VpaGlhaXNqd25hbGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NDg0MDUsImV4cCI6MjA3ODMyNDQwNX0.Tj1_XyrC5XsnKtekYop_dWuCdng1hXHHVWqzjr3vJJQ
```

## 🔍 How It Works

### Data Flow

1. **Profile Creation/Loading**
   - User selects profile → `getOrCreateProfile(name)` → Supabase creates/fetches profile
   - `currentProfileId` stores the UUID for all operations

2. **Calibration**
   - User calibrates letter → Audio recorded via MediaRecorder
   - Pattern data (frequency snapshots) + audio blob sent to `saveCalibrationToSupabase()`
   - Audio uploaded to Storage → Get public URL
   - Pattern + audio URL saved to `calibrations` table

3. **Loading Calibrations**
   - On profile switch → `loadCalibrationsFromSupabase()`
   - Fetches all calibrations for current profile
   - Populates `calibrationData` object
   - Audio URL available at `calibrationData[letter].audioUrl`

### Storage vs localStorage

- **Supabase Storage:** Audio files (unlimited space)
- **Supabase Database:** Pattern data, audio URLs, metadata
- **localStorage:** Backup/fallback + profile names (for now)

## ⚠️ Important Notes

1. **No Authentication:** Currently using public policies (fine for MVP)
2. **Audio Format:** WebM (browser native)
3. **Storage:** ~100KB per audio file × 26 letters = ~2.6MB per profile (tiny!)
4. **Cost:** Free tier allows 500MB storage + 2GB bandwidth (plenty for MVP)

## 🚀 Next Steps (Future)

1. Add user authentication (Supabase Auth)
2. Add profile avatars
3. Track pronunciation history over time
4. Share calibrations between devices
5. Export calibration data
6. Add admin panel for monitoring
