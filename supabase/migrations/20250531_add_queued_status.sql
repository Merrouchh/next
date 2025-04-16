-- Migration to add 'queued' status to clip_processing_status enum
ALTER TYPE clip_processing_status ADD VALUE IF NOT EXISTS 'queued' AFTER 'processing';

-- Update functions that map between status fields
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
        WHEN 'queued' THEN 'queued'
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
        WHEN 'queued' THEN 'queued'::clip_processing_status
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
        WHEN 'queued' THEN 'queued'::clip_processing_status
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
        WHEN 'queued' THEN 'queued'
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

-- Update comments to reflect the change
COMMENT ON TYPE clip_processing_status IS 'Status of clip processing including queued state'; 