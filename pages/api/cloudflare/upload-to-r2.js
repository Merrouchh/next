import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getStatusMessage, getMinProgressForStatus } from '../../../CloudFlareStreamProgressDataUpdate/src/statusUtils.js';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Track active uploads to prevent duplicates
const activeUploads = new Set();

/**
 * API endpoint to upload a video from Cloudflare to R2 storage
 * 
 * This endpoint fetches the MP4 from Cloudflare and uploads it to R2 storage.
 * It updates the clip status to 'complete' after successful upload.
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { videoUid } = req.body;
  const source = req.headers.source || 'unknown';
  
  if (!videoUid) {
    return res.status(400).json({ message: 'Missing videoUid parameter' });
  }

  // Check if this video is already being uploaded
  if (activeUploads.has(videoUid)) {
    console.log(`[UPLOAD-R2][${videoUid}] Upload already in progress, skipping`);
    return res.status(409).json({ message: 'Upload already in progress for this video' });
  }

  // Mark this video as being uploaded
  activeUploads.add(videoUid);
  
  try {
    console.log(`[UPLOAD-R2][${videoUid}] Starting upload process. Source: ${source}`);
    
    // Get video from database
    const { data: video, error: videoError } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();
    
    if (videoError) {
      console.error(`[UPLOAD-R2][${videoUid}] Error fetching video: ${videoError.message}`);
      return res.status(500).json({ message: `Error fetching video: ${videoError.message}` });
    }
    
    if (!video) {
      console.log(`[UPLOAD-R2][${videoUid}] Video not found in database`);
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if video is already completed
    if (video.status === 'complete') {
      console.log(`[UPLOAD-R2][${videoUid}] Video already in complete status, skipping upload`);
      return res.status(200).json({
        message: 'Video already completed',
        videoUid,
        status: 'complete'
      });
    }
    
    if (video.status !== 'mp4downloading') {
      // Update status to mp4downloading if in a valid previous state
      if (['waitformp4', 'ready', 'processing'].includes(video.status)) {
        console.log(`[UPLOAD-R2][${videoUid}] Changing status from ${video.status} to mp4downloading`);
        
        await supabase
          .from('clips')
          .update({
            status: 'mp4downloading',
            status_message: getStatusMessage('mp4downloading'),
            progress: getMinProgressForStatus('mp4downloading')
          })
          .eq('cloudflare_uid', videoUid);
      } else {
        console.log(`[UPLOAD-R2][${videoUid}] Video in unexpected status: ${video.status}, proceeding anyway`);
      }
    }
    
    // Check if we have the MP4 URL
    if (!video.mp4_download_url) {
      console.log(`[UPLOAD-R2][${videoUid}] No MP4 URL found, checking status`);
      
      try {
        // Call poll-mp4-status to get the URL
        const response = await fetch('http://localhost:3000/api/cloudflare/poll-mp4-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Source': 'upload-r2'
          },
          body: JSON.stringify({ videoUid })
        });
        
        if (!response.ok) {
          throw new Error(`Poll MP4 API returned ${response.status}: ${response.statusText}`);
        }
        
        const pollResult = await response.json();
        console.log(`[UPLOAD-R2][${videoUid}] MP4 poll result:`, pollResult);
        
        // Re-fetch video to get updated MP4 URL
        const { data: updatedVideo, error: updateError } = await supabase
          .from('clips')
          .select('*')
          .eq('cloudflare_uid', videoUid)
          .single();
        
        if (updateError) {
          throw new Error(`Error re-fetching video: ${updateError.message}`);
        }
        
        if (!updatedVideo.mp4_download_url) {
          throw new Error('MP4 URL still not available');
        }
        
        // Update our reference
        video.mp4_download_url = updatedVideo.mp4_download_url;
        
      } catch (pollError) {
        console.error(`[UPLOAD-R2][${videoUid}] Error getting MP4 URL: ${pollError.message}`);
        
        await supabase
          .from('clips')
          .update({
            error_message: `Failed to get MP4 URL: ${pollError.message}`
          })
          .eq('cloudflare_uid', videoUid);
        
        return res.status(500).json({ message: `Error getting MP4 URL: ${pollError.message}` });
      }
    }
    
    console.log(`[UPLOAD-R2][${videoUid}] Starting download from: ${video.mp4_download_url}`);
    
    // Update progress
    await supabase
      .from('clips')
      .update({
        status_message: 'Downloading MP4 from Cloudflare...',
        progress: Math.max(getMinProgressForStatus('mp4downloading'), 75)
      })
      .eq('cloudflare_uid', videoUid);
    
    // Download MP4 from Cloudflare
    const mp4Response = await fetch(video.mp4_download_url);
    
    if (!mp4Response.ok) {
      console.error(`[UPLOAD-R2][${videoUid}] Error downloading MP4: ${mp4Response.status} ${mp4Response.statusText}`);
      
      await supabase
        .from('clips')
        .update({
          error_message: `Failed to download MP4: ${mp4Response.statusText}`
        })
        .eq('cloudflare_uid', videoUid);
      
      return res.status(500).json({ message: `Error downloading MP4: ${mp4Response.statusText}` });
    }
    
    const mp4Data = await mp4Response.arrayBuffer();
    console.log(`[UPLOAD-R2][${videoUid}] Downloaded MP4, size: ${Math.round(mp4Data.byteLength / 1024 / 1024)}MB`);
    
    // Update progress
    await supabase
      .from('clips')
      .update({
        status_message: 'Uploading MP4 to R2...',
        progress: Math.max(getMinProgressForStatus('mp4downloading'), 85)
      })
      .eq('cloudflare_uid', videoUid);
    
    // Initialize R2 client
    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });
    
    // Generate a unique key for the object
    const filename = `${videoUid}.mp4`;
    const r2ObjectKey = `videos/${filename}`;
    
    // Upload to R2
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2ObjectKey,
      Body: Buffer.from(mp4Data),
      ContentType: 'video/mp4'
    });
    
    console.log(`[UPLOAD-R2][${videoUid}] Uploading to R2 with key: ${r2ObjectKey}`);
    const r2Result = await r2.send(putCommand);
    console.log(`[UPLOAD-R2][${videoUid}] R2 upload complete:`, r2Result);
    
    // Generate public URL
    const publicUrl = `${R2_PUBLIC_URL}/${r2ObjectKey}`;
    console.log(`[UPLOAD-R2][${videoUid}] Public URL: ${publicUrl}`);
    
    // Update database with complete status
    const { error: updateError } = await supabase
      .from('clips')
      .update({
        status: 'complete',
        status_message: getStatusMessage('complete'),
        progress: 100,
        r2_url: publicUrl,
        completed_at: new Date().toISOString()
      })
      .eq('cloudflare_uid', videoUid);
    
    if (updateError) {
      console.error(`[UPLOAD-R2][${videoUid}] Error updating database: ${updateError.message}`);
      return res.status(500).json({ message: `Error updating database: ${updateError.message}` });
    }
    
    console.log(`[UPLOAD-R2][${videoUid}] Process complete, video available at: ${publicUrl}`);
    
    return res.status(200).json({
      message: 'Upload complete',
      videoUid,
      publicUrl,
      status: 'complete'
    });
    
  } catch (error) {
    console.error(`[UPLOAD-R2][${videoUid}] Unexpected error: ${error.message}`);
    
    // Update with error info
    try {
      await supabase
        .from('clips')
        .update({
          error_message: error.message
        })
        .eq('cloudflare_uid', videoUid);
    } catch (updateError) {
      console.error(`[UPLOAD-R2][${videoUid}] Error updating error message: ${updateError.message}`);
    }
    
    return res.status(500).json({ message: error.message });
  } finally {
    // Always clean up the active upload tracking
    activeUploads.delete(videoUid);
  }
}