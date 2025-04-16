# Flag-based Status Management System

## Overview

This document describes the flag-based status management system implemented for clip processing. Instead of having multiple processes directly update the `status` field (which can lead to race conditions and status cycling), we now use process-specific flags in the `processing_details` JSON field to track progress. A database trigger automatically computes the appropriate status based on these flags.

## Database Trigger

The core of this system is a PostgreSQL function and trigger that automatically computes the status based on processing_details flags. This ensures consistent status computation regardless of which process updates the flags.

```sql
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
  ELSIF NEW.processing_details->>'mp4_ready' = 'true' THEN
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
  
  -- Only update status if we have a valid new status
  IF new_status IS NOT NULL AND (NEW.status IS NULL OR NEW.status <> new_status) THEN
    NEW.status := new_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Key Flags by Process

### 1. CloudFlare Monitor (index.js)
- `cloudflare_status`: Current status from Cloudflare API
- `progress`: Percentage complete
- `handoff_to_mp4_processing`: Signals when the video is ready for MP4 processing

### 2. MP4 Processing (enable-mp4.js)
- `mp4_processing_started`: Signals start of MP4 processing
- `mp4_poll_started`: Signals start of polling for MP4 status
- `mp4_status`: Current MP4 generation status
- `mp4_ready`: Signals MP4 is ready for download
- `mp4_download_url`: URL for downloading the MP4 file

### 3. R2 Upload (upload-to-r2.js)
- `r2_upload_started`: Signals start of R2 upload process
- `r2_upload_complete`: Signals R2 upload is complete
- `r2_public_url`: Public URL for the uploaded file

### 4. Error Handling
- `error_message`: Error message if something went wrong
- `error_time`: When the error occurred
- `error_details`: Additional error details

## Benefits

1. **No Race Conditions**: Each process can set its own flags without conflicting with other processes
2. **Automatic Status Computation**: Status is consistently computed based on flags
3. **Audit Trail**: Full history of processing in the details field
4. **Robustness**: Multiple processes can update the same record concurrently
5. **Clear Process Boundaries**: Each service has its own set of flags

## Status Progression

1. `uploading`: Initial upload to Cloudflare
2. `processing`: Cloudflare is processing the video
3. `stream_ready`: Video is ready for streaming, MP4 generation can begin
4. `mp4_processing`: MP4 generation has started
5. `waitformp4`: Waiting for MP4 to be ready
6. `mp4downloading`: MP4 is ready to download and upload to R2
7. `r2_uploading`: Uploading MP4 to R2 storage
8. `complete`: Process is complete, video is ready

Error can occur at any stage and will be set if an error_message is present. 