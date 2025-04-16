-- Migration to add processing_status to clips table
-- This tracks the detailed status of video processing

-- Create an enum type for processing status (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clip_processing_status') THEN
    CREATE TYPE clip_processing_status AS ENUM (
      'pending',              -- Initial state when the clip is first created
      'uploading',            -- Currently uploading to Cloudflare
      'processing',           -- Processing by Cloudflare
      'stream_ready',         -- Stream is ready but MP4 not yet processed
      'mp4_processing',       -- MP4 is being generated
      'r2_uploading',         -- Uploading to R2 storage
      'complete',             -- All processing complete
      'error'                 -- Error occurred during processing
    );
  END IF;
END$$;

-- Add the processing_status column to clips table
ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS processing_status clip_processing_status DEFAULT 'pending';

-- Add processing_details JSON column to store additional status information
ALTER TABLE clips
ADD COLUMN IF NOT EXISTS processing_details JSONB DEFAULT '{}'::jsonb;

-- Function to update processing_status based on media_clips changes
CREATE OR REPLACE FUNCTION update_clips_processing_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Find matching clip record
  UPDATE clips
  SET 
    processing_status = CASE
      WHEN NEW.status = 'pendingupload' THEN 'pending'::clip_processing_status
      WHEN NEW.status = 'uploading' THEN 'uploading'::clip_processing_status
      WHEN NEW.status IN ('queued', 'video_in_queue', 'processing', 'inprogress') THEN 'processing'::clip_processing_status
      WHEN NEW.status = 'ready' AND NEW.metadata->>'mp4_processing' = 'true' THEN 'mp4_processing'::clip_processing_status
      WHEN NEW.status = 'ready' AND NEW.metadata->>'r2_upload_processing' = 'true' THEN 'r2_uploading'::clip_processing_status
      WHEN NEW.status = 'ready' AND NEW.ready_to_stream = true AND (NEW.metadata->>'mp4_processing' IS NULL OR NEW.metadata->>'mp4_processing' = 'false') THEN 'stream_ready'::clip_processing_status
      WHEN NEW.status = 'ready' AND NEW.metadata->>'r2_public_url' IS NOT NULL THEN 'complete'::clip_processing_status
      WHEN NEW.status = 'error' THEN 'error'::clip_processing_status
      ELSE clips.processing_status
    END,
    processing_details = jsonb_build_object(
      'progress', NEW.processing_progress,
      'cloudflare_status', NEW.metadata->>'cloudflare_status',
      'mp4_processing', NEW.metadata->>'mp4_processing',
      'r2_upload_processing', NEW.metadata->>'r2_upload_processing',
      'error_message', NEW.error_message,
      'last_updated', CURRENT_TIMESTAMP
    )
  WHERE cloudflare_uid = NEW.cloudflare_uid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update clips table when media_clips is updated
DROP TRIGGER IF EXISTS update_clips_status ON media_clips;
CREATE TRIGGER update_clips_status
AFTER UPDATE ON media_clips
FOR EACH ROW
EXECUTE FUNCTION update_clips_processing_status();

-- Function to sync new media_clips records to clips
CREATE OR REPLACE FUNCTION sync_new_media_clips_to_clips()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the clip isn't already in the clips table
  IF NOT EXISTS (SELECT 1 FROM clips WHERE cloudflare_uid = NEW.cloudflare_uid) THEN
    -- Get user information
    DECLARE
      user_record RECORD;
    BEGIN
      SELECT username, id INTO user_record
      FROM auth.users
      WHERE id = NEW.user_id;
      
      -- Insert a new record in the clips table
      INSERT INTO clips (
        cloudflare_uid,
        user_id,
        username,
        title,
        description,
        game,
        visibility,
        uploaded_at,
        processing_status,
        processing_details
      ) VALUES (
        NEW.cloudflare_uid,
        NEW.user_id,
        user_record.username,
        NEW.title,
        NEW.description,
        NEW.game,
        'public', -- Default visibility
        NEW.uploaded_at,
        CASE
          WHEN NEW.status = 'pendingupload' THEN 'pending'::clip_processing_status
          WHEN NEW.status = 'uploading' THEN 'uploading'::clip_processing_status
          WHEN NEW.status IN ('queued', 'video_in_queue', 'processing', 'inprogress') THEN 'processing'::clip_processing_status
          WHEN NEW.status = 'ready' THEN 'stream_ready'::clip_processing_status
          WHEN NEW.status = 'error' THEN 'error'::clip_processing_status
          ELSE 'pending'::clip_processing_status
        END,
        jsonb_build_object(
          'progress', NEW.processing_progress,
          'cloudflare_status', NEW.metadata->>'cloudflare_status',
          'mp4_processing', NEW.metadata->>'mp4_processing',
          'error_message', NEW.error_message,
          'last_updated', CURRENT_TIMESTAMP
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE NOTICE 'Failed to create clips entry for %: %', NEW.cloudflare_uid, SQLERRM;
    END;
  ELSE
    -- If clip already exists, just update its processing status
    UPDATE clips
    SET 
      processing_status = CASE
        WHEN NEW.status = 'pendingupload' THEN 'pending'::clip_processing_status
        WHEN NEW.status = 'uploading' THEN 'uploading'::clip_processing_status
        WHEN NEW.status IN ('queued', 'video_in_queue', 'processing', 'inprogress') THEN 'processing'::clip_processing_status
        WHEN NEW.status = 'ready' AND NEW.metadata->>'mp4_processing' = 'true' THEN 'mp4_processing'::clip_processing_status
        WHEN NEW.status = 'ready' AND NEW.metadata->>'r2_upload_processing' = 'true' THEN 'r2_uploading'::clip_processing_status
        WHEN NEW.status = 'ready' AND NEW.ready_to_stream = true THEN 'stream_ready'::clip_processing_status
        WHEN NEW.status = 'error' THEN 'error'::clip_processing_status
        ELSE clips.processing_status
      END,
      processing_details = jsonb_build_object(
        'progress', NEW.processing_progress,
        'cloudflare_status', NEW.metadata->>'cloudflare_status',
        'mp4_processing', NEW.metadata->>'mp4_processing',
        'r2_upload_processing', NEW.metadata->>'r2_upload_processing',
        'error_message', NEW.error_message,
        'last_updated', CURRENT_TIMESTAMP
      )
    WHERE cloudflare_uid = NEW.cloudflare_uid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that fires when a new media_clip is inserted
DROP TRIGGER IF EXISTS sync_new_media_clips ON media_clips;
CREATE TRIGGER sync_new_media_clips
AFTER INSERT ON media_clips
FOR EACH ROW
EXECUTE FUNCTION sync_new_media_clips_to_clips(); 