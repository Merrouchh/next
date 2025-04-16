-- Migration to remove the redundant status column from clips table

-- First, drop the trigger that synchronizes the fields
DROP TRIGGER IF EXISTS sync_clips_status_fields ON clips;
DROP FUNCTION IF EXISTS sync_status_fields();

-- Ensure all records have a valid processing_status before removing status
-- This converts any records that might have status but no processing_status
UPDATE clips
SET processing_status = CASE 
  WHEN status = 'pendingupload' THEN 'pending'::clip_processing_status
  WHEN status = 'uploading' THEN 'uploading'::clip_processing_status
  WHEN status = 'processing' THEN 'processing'::clip_processing_status
  WHEN status = 'ready' AND mp4link IS NOT NULL THEN 'complete'::clip_processing_status
  WHEN status = 'ready' THEN 'stream_ready'::clip_processing_status
  WHEN status = 'error' THEN 'error'::clip_processing_status
  ELSE 'pending'::clip_processing_status
END
WHERE status IS NOT NULL 
AND (processing_status IS NULL OR processing_status = '');

-- Finally, drop the status column
ALTER TABLE clips DROP COLUMN status;

-- Add a comment for documentation purposes
COMMENT ON TABLE clips IS 'Contains video clips information with processing_status tracking the detailed workflow state'; 