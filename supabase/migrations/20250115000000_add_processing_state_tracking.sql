-- Add processing state tracking to recordings table

-- Create enum for processing states
CREATE TYPE processing_state AS ENUM (
    'recorded',
    'uploading', 
    'uploaded',
    'transcribing',
    'transcribed',
    'webhook_sending',
    'webhook_sent',
    'completed',
    'upload_failed',
    'transcribe_failed', 
    'webhook_failed'
);

-- Add new columns for better state tracking
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS processing_state processing_state DEFAULT 'recorded',
ADD COLUMN IF NOT EXISTS processing_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_error JSONB,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS upload_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS transcription_job_id TEXT,
ADD COLUMN IF NOT EXISTS last_state_change_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for processing state queries
CREATE INDEX IF NOT EXISTS idx_recordings_processing_state ON recordings(processing_state);
CREATE INDEX IF NOT EXISTS idx_recordings_next_retry ON recordings(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recordings_user_processing ON recordings(user_id, processing_state);

-- Create function to update last_state_change_at when processing_state changes
CREATE OR REPLACE FUNCTION update_last_state_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.processing_state IS DISTINCT FROM NEW.processing_state THEN
        NEW.last_state_change_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for state change tracking
DROP TRIGGER IF EXISTS update_recordings_last_state_change ON recordings;
CREATE TRIGGER update_recordings_last_state_change
    BEFORE UPDATE ON recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_last_state_change();

-- Enable Realtime for recordings table
ALTER PUBLICATION supabase_realtime ADD TABLE recordings;

-- Create a view for easier querying of recording states
CREATE OR REPLACE VIEW recording_states AS
SELECT 
    id,
    user_id,
    timestamp,
    duration,
    title,
    transcript,
    processing_state,
    processing_step,
    processing_error,
    retry_count,
    upload_progress,
    last_state_change_at,
    CASE 
        WHEN processing_state IN ('upload_failed', 'transcribe_failed', 'webhook_failed') THEN true
        ELSE false
    END as is_failed,
    CASE
        WHEN processing_state = 'completed' THEN true
        ELSE false
    END as is_completed
FROM recordings;

-- Grant permissions on the view
GRANT SELECT ON recording_states TO authenticated;

-- Views can't have RLS policies directly applied in PostgreSQL
-- Instead, the view will inherit permissions from the underlying table (recordings)
-- which already has RLS policies

-- Function to safely transition processing states
CREATE OR REPLACE FUNCTION transition_processing_state(
    p_recording_id TEXT,
    p_new_state processing_state,
    p_error JSONB DEFAULT NULL,
    p_progress INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_state processing_state;
    v_user_id UUID;
BEGIN
    -- Get current state and verify ownership
    SELECT processing_state, user_id INTO v_current_state, v_user_id
    FROM recordings
    WHERE id = p_recording_id;
    
    -- Check if user owns the recording
    IF v_user_id != auth.uid() THEN
        RETURN FALSE;
    END IF;
    
    -- Update the recording
    UPDATE recordings
    SET 
        processing_state = p_new_state,
        processing_error = CASE 
            WHEN p_error IS NOT NULL THEN p_error
            WHEN p_new_state IN ('upload_failed', 'transcribe_failed', 'webhook_failed') THEN processing_error
            ELSE NULL
        END,
        upload_progress = COALESCE(p_progress, upload_progress),
        retry_count = CASE
            WHEN p_new_state IN ('upload_failed', 'transcribe_failed', 'webhook_failed') 
            THEN retry_count + 1
            ELSE retry_count
        END,
        next_retry_at = CASE
            WHEN p_new_state IN ('upload_failed', 'transcribe_failed', 'webhook_failed')
            THEN NOW() + INTERVAL '1 minute' * POWER(2, LEAST(retry_count, 5))
            ELSE NULL
        END
    WHERE id = p_recording_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION transition_processing_state TO authenticated;

-- Migrate existing data to new state system
UPDATE recordings
SET processing_state = CASE
    WHEN status = 'recording' THEN 'recorded'::processing_state
    WHEN status = 'local' THEN 'recorded'::processing_state
    WHEN status = 'queued' THEN 'recorded'::processing_state
    WHEN status = 'uploading' THEN 'uploading'::processing_state
    WHEN status = 'uploaded' AND transcript IS NOT NULL THEN 'completed'::processing_state
    WHEN status = 'uploaded' THEN 'uploaded'::processing_state
    WHEN status = 'failed' THEN 'upload_failed'::processing_state
    ELSE 'recorded'::processing_state
END
WHERE processing_state IS NULL;