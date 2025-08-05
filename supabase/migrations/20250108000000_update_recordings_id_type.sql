-- Update recordings table to use TEXT for id instead of UUID
-- This allows both UUID and legacy ID formats

-- First, drop any foreign key constraints that reference recordings.id
-- (Add these if you have any)

-- Alter the id column type
ALTER TABLE recordings 
ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Ensure the primary key constraint is maintained
-- (It should already be there, but just to be safe)
ALTER TABLE recordings
DROP CONSTRAINT IF EXISTS recordings_pkey,
ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);

-- Add check constraint to ensure id is not empty
ALTER TABLE recordings
ADD CONSTRAINT recordings_id_not_empty CHECK (id != '');

-- Drop ALL existing policies on recordings table before altering column types
DROP POLICY IF EXISTS "Allow insert without user_id temporarily" ON recordings;
DROP POLICY IF EXISTS "Users can view own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can insert own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can update own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can delete own recordings" ON recordings;
DROP POLICY IF EXISTS "Allow all operations on recordings" ON recordings;

-- Update the user_id column to use UUID type if it's not already
ALTER TABLE recordings
ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Add index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);

-- Update RLS policies to use auth.uid()
DROP POLICY IF EXISTS "Allow all operations on recordings" ON recordings;

CREATE POLICY "Users can view own recordings" ON recordings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings" ON recordings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings" ON recordings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings" ON recordings
    FOR DELETE USING (auth.uid() = user_id);