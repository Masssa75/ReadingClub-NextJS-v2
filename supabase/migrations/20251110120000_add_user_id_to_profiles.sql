-- Add user_id column to profiles table for linking anonymous profiles to authenticated users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Update RLS policies to support both anonymous and authenticated users

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on profiles" ON profiles;

-- Create new policies that work for both anonymous and authenticated users
CREATE POLICY "Users can read their own profiles"
    ON profiles FOR SELECT
    USING (
        user_id IS NULL  -- Anonymous profiles (anyone can read)
        OR user_id = auth.uid()  -- Authenticated user's profiles
    );

CREATE POLICY "Anyone can create profiles"
    ON profiles FOR INSERT
    WITH CHECK (true);  -- Allow creation (will be anonymous initially)

CREATE POLICY "Users can update their own profiles"
    ON profiles FOR UPDATE
    USING (
        user_id IS NULL  -- Can update anonymous profiles (for linking)
        OR user_id = auth.uid()  -- Can update own authenticated profiles
    );

CREATE POLICY "Users can delete their own profiles"
    ON profiles FOR DELETE
    USING (user_id = auth.uid());  -- Only authenticated users can delete

-- Update calibrations policies to work with anonymous profiles
DROP POLICY IF EXISTS "Allow all operations on calibrations" ON calibrations;

CREATE POLICY "Users can read calibrations for their profiles"
    ON calibrations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = calibrations.profile_id
            AND (profiles.user_id IS NULL OR profiles.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create calibrations for their profiles"
    ON calibrations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = calibrations.profile_id
            AND (profiles.user_id IS NULL OR profiles.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can update calibrations for their profiles"
    ON calibrations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = calibrations.profile_id
            AND (profiles.user_id IS NULL OR profiles.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can delete calibrations for their profiles"
    ON calibrations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = calibrations.profile_id
            AND profiles.user_id = auth.uid()  -- Only authenticated users can delete
        )
    );
