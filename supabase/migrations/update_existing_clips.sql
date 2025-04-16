-- Migration to update existing clips with processing status
-- This will set appropriate processing_status for all existing clips

-- Update clips that already have MP4 links to 'complete' status
UPDATE clips
SET 
  processing_status = 'complete'::clip_processing_status,
  processing_details = jsonb_build_object(
    'progress', 100,
    'cloudflare_status', 'ready',
    'mp4_processing', false,
    'r2_upload_processing', false,
    'completed_at', CURRENT_TIMESTAMP,
    'last_updated', CURRENT_TIMESTAMP
  )
WHERE 
  mp4link IS NOT NULL 
  AND (processing_status IS NULL OR processing_status != 'complete');

-- Update clips that are still in processing (no MP4 link yet)
WITH media_clip_status AS (
  SELECT 
    mc.cloudflare_uid,
    mc.status,
    mc.ready_to_stream,
    mc.metadata,
    mc.processing_progress
  FROM 
    media_clips mc
  JOIN 
    clips c ON mc.cloudflare_uid = c.cloudflare_uid
  WHERE 
    c.mp4link IS NULL
)
UPDATE clips c
SET 
  processing_status = CASE
    WHEN mcs.status = 'pendingupload' THEN 'pending'::clip_processing_status
    WHEN mcs.status = 'uploading' THEN 'uploading'::clip_processing_status
    WHEN mcs.status IN ('queued', 'video_in_queue', 'processing', 'inprogress') THEN 'processing'::clip_processing_status
    WHEN mcs.status = 'ready' AND mcs.metadata->>'mp4_processing' = 'true' THEN 'mp4_processing'::clip_processing_status
    WHEN mcs.status = 'ready' AND mcs.metadata->>'r2_upload_processing' = 'true' THEN 'r2_uploading'::clip_processing_status
    WHEN mcs.status = 'ready' AND mcs.ready_to_stream = true THEN 'stream_ready'::clip_processing_status
    WHEN mcs.status = 'error' THEN 'error'::clip_processing_status
    ELSE 'pending'::clip_processing_status
  END,
  processing_details = jsonb_build_object(
    'progress', mcs.processing_progress,
    'cloudflare_status', mcs.metadata->>'cloudflare_status',
    'mp4_processing', mcs.metadata->>'mp4_processing',
    'r2_upload_processing', mcs.metadata->>'r2_upload_processing',
    'last_updated', CURRENT_TIMESTAMP
  )
FROM 
  media_clip_status mcs
WHERE 
  c.cloudflare_uid = mcs.cloudflare_uid
  AND c.mp4link IS NULL;

-- For clips without a match in media_clips, set to pending if they have no status
UPDATE clips
SET 
  processing_status = 'pending'::clip_processing_status,
  processing_details = jsonb_build_object(
    'last_updated', CURRENT_TIMESTAMP,
    'note', 'Auto-initialized during migration'
  )
WHERE 
  (processing_status IS NULL OR processing_status = 'pending')
  AND mp4link IS NULL
  AND cloudflare_uid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM media_clips 
    WHERE media_clips.cloudflare_uid = clips.cloudflare_uid
  );

-- For clips with a cloudflare_uid but no processing_status at all, 
-- set status based on whether they have mp4link
UPDATE clips
SET 
  processing_status = CASE 
    WHEN mp4link IS NOT NULL THEN 'complete'::clip_processing_status 
    ELSE 'pending'::clip_processing_status 
  END,
  processing_details = jsonb_build_object(
    'last_updated', CURRENT_TIMESTAMP,
    'note', 'Auto-initialized during migration',
    'progress', CASE WHEN mp4link IS NOT NULL THEN 100 ELSE 0 END
  )
WHERE 
  processing_status IS NULL
  AND cloudflare_uid IS NOT NULL; 