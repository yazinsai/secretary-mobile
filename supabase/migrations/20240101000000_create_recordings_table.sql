-- Create recordings table
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    duration INTEGER NOT NULL,
    audio_url TEXT,
    transcript TEXT,
    corrected_transcript TEXT,
    title TEXT,
    status TEXT NOT NULL,
    webhook_url TEXT,
    webhook_status TEXT,
    webhook_last_sent_at TIMESTAMPTZ,
    error TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_recordings_timestamp ON recordings(timestamp DESC);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE
    ON recordings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now
-- You may want to update this based on your authentication strategy
CREATE POLICY "Allow all operations on recordings" ON recordings
    FOR ALL USING (true);