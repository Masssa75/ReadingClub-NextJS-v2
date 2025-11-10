-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create calibrations table
CREATE TABLE IF NOT EXISTS calibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    letter TEXT NOT NULL,
    pattern_data JSONB NOT NULL,
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, letter)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calibrations_profile_id ON calibrations(profile_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_letter ON calibrations(letter);
CREATE INDEX IF NOT EXISTS idx_calibrations_created_at ON calibrations(created_at DESC);

-- CRITICAL: Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth for MVP)
CREATE POLICY "Allow all operations on profiles"
    ON profiles FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on calibrations"
    ON calibrations FOR ALL
    USING (true)
    WITH CHECK (true);

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
