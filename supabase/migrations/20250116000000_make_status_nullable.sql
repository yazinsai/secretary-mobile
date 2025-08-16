-- Make status column nullable since we're using processing_state now
ALTER TABLE recordings 
ALTER COLUMN status DROP NOT NULL;

-- Set default value for status to maintain backward compatibility
ALTER TABLE recordings 
ALTER COLUMN status SET DEFAULT 'local';

-- Update existing records that might have null status
UPDATE recordings 
SET status = 'local' 
WHERE status IS NULL;

-- Add comment to explain the field is legacy
COMMENT ON COLUMN recordings.status IS 'Legacy field - use processing_state instead';