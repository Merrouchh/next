-- Add periodic_notification_count column to computer_queue for notification tracking
ALTER TABLE computer_queue 
ADD COLUMN IF NOT EXISTS periodic_notification_count INTEGER DEFAULT 0 NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN computer_queue.periodic_notification_count IS 'Number of periodic WhatsApp notifications sent to this queue entry.'; 