-- Create a function to compute clip status based on processing_details flags
CREATE OR REPLACE FUNCTION compute_clip_status()
RETURNS TRIGGER AS $$
DECLARE
  new_status TEXT;
BEGIN
  -- Determine status based on flags in processing_details
  IF NEW.processing_details->>'error_message' IS NOT NULL THEN
    new_status := 'error';
  ELSIF NEW.processing_details->>'r2_upload_complete' = 'true' THEN
    new_status := 'complete';
  ELSIF NEW.processing_details->>'r2_upload_started' = 'true' THEN
    new_status := 'r2_uploading';
  ELSIF NEW.processing_details->>'mp4_ready' = 'true' OR NEW.processing_details->>'mp4_download_url' IS NOT NULL THEN
    new_status := 'mp4downloading';
  ELSIF NEW.processing_details->>'mp4_poll_started' = 'true' THEN
    new_status := 'waitformp4';
  ELSIF NEW.processing_details->>'mp4_processing_started' = 'true' THEN
    new_status := 'mp4_processing';
  ELSIF NEW.processing_details->>'cloudflare_status' = 'ready' THEN
    new_status := 'stream_ready';
  ELSIF NEW.processing_details->>'cloudflare_status' = 'inprogress' THEN
    new_status := 'processing';
  ELSIF NEW.processing_details->>'cloudflare_status' = 'pendingupload' THEN
    new_status := 'uploading';
  ELSIF NEW.processing_details->>'cloudflare_status' = 'queued' THEN
    new_status := 'queued';
  END IF;
  
  -- Only update status if we have a valid new status and it would change the status
  IF new_status IS NOT NULL AND (NEW.status IS NULL OR NEW.status <> new_status) THEN
    NEW.status := new_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS update_clip_status ON clips;

CREATE TRIGGER update_clip_status
BEFORE UPDATE ON clips
FOR EACH ROW
EXECUTE FUNCTION compute_clip_status();

-- Log the migration
INSERT INTO _migrations (name, executed_at) 
VALUES ('20231201_clip_status_trigger', NOW()); 