-- Migration to synchronize status and processing_status fields

-- Function to map processing_status to status
CREATE OR REPLACE FUNCTION map_processing_status_to_status(proc_status clip_processing_status)
RETURNS TEXT AS $$
BEGIN
  CASE proc_status
    WHEN 'pending' THEN
      RETURN 'pendingupload';
    WHEN 'uploading' THEN
      RETURN 'uploading';
    WHEN 'processing' THEN
      RETURN 'processing';
    WHEN 'stream_ready' THEN
      RETURN 'ready';
    WHEN 'mp4_processing' THEN
      RETURN 'ready';
    WHEN 'r2_uploading' THEN
      RETURN 'ready';
    WHEN 'complete' THEN
      RETURN 'ready';
    WHEN 'error' THEN
      RETURN 'error';
    WHEN 'hidden_error' THEN
      RETURN 'error';
    ELSE
      RETURN proc_status::text;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update records where processing_status is set but status is not
UPDATE clips
SET status = map_processing_status_to_status(processing_status)
WHERE processing_status IS NOT NULL 
AND (status IS NULL OR status = '');

-- Update records where status is set but processing_status is not
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
AND processing_status IS NULL;

-- Drop the temporary function
DROP FUNCTION map_processing_status_to_status(clip_processing_status);

-- Add a trigger to keep status and processing_status synchronized
CREATE OR REPLACE FUNCTION sync_status_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- If processing_status is changing but status isn't explicitly set, update status
    IF NEW.processing_status IS DISTINCT FROM OLD.processing_status AND 
       NEW.status IS NOT DISTINCT FROM OLD.status THEN
      NEW.status := CASE NEW.processing_status
        WHEN 'pending' THEN 'pendingupload'
        WHEN 'uploading' THEN 'uploading'
        WHEN 'processing' THEN 'processing'
        WHEN 'stream_ready' THEN 'ready'
        WHEN 'mp4_processing' THEN 'ready'
        WHEN 'r2_uploading' THEN 'ready'
        WHEN 'complete' THEN 'ready'
        WHEN 'error' THEN 'error'
        WHEN 'hidden_error' THEN 'error'
        ELSE NEW.processing_status::text
      END;
    END IF;
    
    -- If status is changing but processing_status isn't explicitly set, update processing_status
    IF NEW.status IS DISTINCT FROM OLD.status AND 
       NEW.processing_status IS NOT DISTINCT FROM OLD.processing_status THEN
      NEW.processing_status := CASE NEW.status
        WHEN 'pendingupload' THEN 'pending'::clip_processing_status
        WHEN 'uploading' THEN 'uploading'::clip_processing_status
        WHEN 'processing' THEN 'processing'::clip_processing_status
        WHEN 'ready' THEN 
          CASE 
            WHEN NEW.mp4link IS NOT NULL THEN 'complete'::clip_processing_status
            ELSE 'stream_ready'::clip_processing_status
          END
        WHEN 'error' THEN 'error'::clip_processing_status
        ELSE 'pending'::clip_processing_status
      END;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- For new records, ensure both fields are set
    IF NEW.processing_status IS NULL AND NEW.status IS NOT NULL THEN
      NEW.processing_status := CASE NEW.status
        WHEN 'pendingupload' THEN 'pending'::clip_processing_status
        WHEN 'uploading' THEN 'uploading'::clip_processing_status
        WHEN 'processing' THEN 'processing'::clip_processing_status
        WHEN 'ready' THEN 
          CASE 
            WHEN NEW.mp4link IS NOT NULL THEN 'complete'::clip_processing_status
            ELSE 'stream_ready'::clip_processing_status
          END
        WHEN 'error' THEN 'error'::clip_processing_status
        ELSE 'pending'::clip_processing_status
      END;
    ELSIF NEW.status IS NULL AND NEW.processing_status IS NOT NULL THEN
      NEW.status := CASE NEW.processing_status
        WHEN 'pending' THEN 'pendingupload'
        WHEN 'uploading' THEN 'uploading'
        WHEN 'processing' THEN 'processing'
        WHEN 'stream_ready' THEN 'ready'
        WHEN 'mp4_processing' THEN 'ready'
        WHEN 'r2_uploading' THEN 'ready'
        WHEN 'complete' THEN 'ready'
        WHEN 'error' THEN 'error'
        WHEN 'hidden_error' THEN 'error'
        ELSE NEW.processing_status::text
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_clips_status_fields ON clips;
CREATE TRIGGER sync_clips_status_fields
BEFORE INSERT OR UPDATE ON clips
FOR EACH ROW
EXECUTE FUNCTION sync_status_fields();

-- Add comment about migration purpose for future reference
COMMENT ON TRIGGER sync_clips_status_fields ON clips IS 
  'Ensures that status and processing_status fields are synchronized for backward compatibility'; 