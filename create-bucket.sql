-- Create calibration-audio storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('calibration-audio', 'calibration-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for calibration-audio bucket
CREATE POLICY IF NOT EXISTS "Public can upload audio"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'calibration-audio');

CREATE POLICY IF NOT EXISTS "Public can read audio"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'calibration-audio');
