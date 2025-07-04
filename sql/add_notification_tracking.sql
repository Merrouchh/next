-- Add notification tracking columns to computer_queue table
-- This enables simple, database-backed notification state tracking

-- Add columns to track notification state
ALTER TABLE computer_queue 
ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_notified_position INTEGER;

-- Add index for performance on notification queries
CREATE INDEX IF NOT EXISTS idx_computer_queue_notification_tracking 
ON computer_queue(last_notified_at, position, status);

-- Add index for created_at lookups (for new joiner detection)
CREATE INDEX IF NOT EXISTS idx_computer_queue_created_at 
ON computer_queue(created_at, status);

-- Add comments for documentation
COMMENT ON COLUMN computer_queue.last_notified_at IS 'Timestamp when this queue entry was last sent a WhatsApp notification';
COMMENT ON COLUMN computer_queue.last_notified_position IS 'Position this entry was at when last notified (for detecting position changes)';

-- Show current structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'computer_queue' 
ORDER BY ordinal_position; 