-- Migration script to add new columns to existing recordings table
-- Run this if you already have a recordings table in production

-- Add new columns if they don't exist
ALTER TABLE recordings 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS corrected_transcript TEXT,
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_status TEXT,
ADD COLUMN IF NOT EXISTS webhook_last_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_recordings_timestamp ON recordings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_recordings_updated_at ON recordings;
CREATE TRIGGER update_recordings_updated_at 
    BEFORE UPDATE ON recordings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS if not already enabled
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Create policy if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'recordings' 
        AND policyname = 'Allow all operations on recordings'
    ) THEN
        CREATE POLICY "Allow all operations on recordings" ON recordings
            FOR ALL USING (true);
    END IF;
END $$;

-- Instructions:
-- 1. BACKUP YOUR DATABASE FIRST!
-- 2. Run this migration in your Supabase SQL editor
-- 3. This is safe to run multiple times (idempotent)