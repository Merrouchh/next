import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '411af6c1a49ce96694e34c39d5f6b251';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'e93efea911c0938d8827c818a63dc588';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'bff81b2589ed16a3a488ea0e7c46d0d3f59338c0fceebe131453b1e62b98bfed';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'merrouchclips';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-4884e5ccdad64ae89dbf9c9f39875f1b.r2.dev';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Update the database with the current processing status
const updateProcessingStatus = async (videoUid, status, details = {}) => {
  try {
    console.log(`[R2-Status] Updating status to: ${status}, details:`, details);
    
    // Update the clips table
    const { error: clipsError } = await supabase
      .from('clips')
      .update({
        status: status,
        processing_details: {
          ...details,
          r2_upload_processing: status === 'r2_uploading',
          last_updated: new Date().toISOString()
        }
      })
      .eq('cloudflare_uid', videoUid);
      
    if (clipsError) {
      console.log(`[R2-Status] Warning: Failed to update clips table: ${clipsError.message}`);
      return false;
    } else {
      console.log(`[R2-Status] Successfully updated clips table status to ${status}`);
      return true;
    }
  } catch (error) {
    console.log(`[R2-Status] Error updating status: ${error.message}`);
    return false;
  }
};

async function getThumbnailUrl(videoUid) {
  try {
    console.log(`[Step 9c] Getting thumbnail URL for video ${videoUid}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.log(`[Step 9d] Failed to get thumbnail info: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.result && data.result.thumbnail) {
      console.log(`[Step 9e] Found thumbnail URL: ${data.result.thumbnail}`);
      return data.result.thumbnail;
    } else {
      console.log(`[Step 9f] No thumbnail URL found in Cloudflare response`);
      return null;
    }
  } catch (error) {
    console.log(`[Step 9g] Error getting thumbnail URL: ${error.message}`);
    return null;
  }
}

export default async function handler(req, res) {
  // This endpoint should only be accessed with POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('=== R2 UPLOAD PROCESS STARTED ===');
  
  try {
    const { videoUid } = req.body;
    
    console.log(`[Step 1] Processing video UID: ${videoUid}`);
    
    if (!videoUid) {
      console.log('ERROR: Missing videoUid parameter');
      return res.status(400).json({ error: 'Missing videoUid parameter' });
    }
    
    // Check if video exists in clips table
    console.log(`[Step 2] Checking clips table for video ${videoUid}`);
    let { data: videoData, error: videoError } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();
    
    if (videoError || !videoData) {
      console.log('ERROR: Video not found in clips table', { clipsError: videoError });
      await updateProcessingStatus(videoUid, 'error', {
        error_message: 'Video not found in database',
        error_details: 'Not found in clips table'
      });
      return res.status(404).json({ error: 'Video not found in database' });
    }
    
    console.log(`[Step 2c] Found video in clips table with id: ${videoData.id}`);
    
    // Only set r2_uploading if not already in that status
    if (videoData.status !== 'r2_uploading') {
      console.log(`[Step 2d] Setting status to r2_uploading (current: ${videoData.status})`);
      await updateProcessingStatus(videoUid, 'r2_uploading', {
        r2_upload_start_time: new Date().toISOString()
      });
    }
    
    // If the video already has mp4link in clips table and it's an R2 URL, we can skip the upload
    if (videoData.mp4link && videoData.mp4link.includes(R2_PUBLIC_URL)) {
      console.log(`[Step 2e] Video already has R2 link: ${videoData.mp4link}`);
      await updateProcessingStatus(videoUid, 'complete', {
        r2_public_url: videoData.mp4link,
        r2_upload_complete: true,
        r2_upload_complete_time: new Date().toISOString()
      });
      return res.status(200).json({
        success: true,
        r2Url: videoData.mp4link,
        status: 'complete',
        note: 'Using existing R2 link from clips table'
      });
    }
    
    // Add check to avoid re-processing if already processed recently
    if (videoData.status === 'complete' && videoData.processing_details) {
      const lastUpdated = new Date(videoData.processing_details.last_updated || 0);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      if (lastUpdated > fiveMinutesAgo) {
        console.log(`[Step 2f] Video was already processed at ${lastUpdated.toISOString()}, skipping re-processing`);
        return res.status(200).json({
          success: true,
          r2Url: videoData.mp4link,
          status: 'complete',
          note: 'Recently processed, skipping duplicate processing'
        });
      }
    }
    
    const metadata = videoData.processing_details || {};
    console.log(`[Step 3] Video metadata:`, metadata);
    
    // Check if we have the MP4 download URL
    let mp4DownloadUrl = metadata.mp4_download_url || (videoData.processing_details && videoData.processing_details.mp4_download_url);
    
    if (mp4DownloadUrl) {
      console.log(`[Step 4e] Using MP4 download URL: ${mp4DownloadUrl}`);
    } else {
      console.log(`[Step 4] No MP4 download URL found, checking status`);
      
      // If the status is mp4_processing or waitformp4, do not call the enable-mp4 API again
      if (videoData.status === 'waitformp4' || videoData.status === 'mp4_processing') {
        console.log(`[Step 4a] Video is already in ${videoData.status} status, not calling enable-mp4 API again`);
        
        // Update processing details without changing the status
        await supabase
          .from('clips')
          .update({
            processing_details: {
              ...(videoData.processing_details || {}),
              last_checked: new Date().toISOString(),
              mp4_status_message: `Video is still in ${videoData.status} state. Please wait for MP4 processing to complete.`
            }
          })
          .eq('cloudflare_uid', videoUid);
        
        return res.status(409).json({
          error: 'MP4 processing in progress',
          status: videoData.status,
          message: `Video is still in ${videoData.status} state. Please wait for MP4 processing to complete.`
        });
      }
      
      // Try to enable MP4 download
      try {
        // Check current status before attempting to enable MP4 downloads
        // If the video is already in waitformp4 or mp4_processing status, don't call the enable-mp4 API again
        if (videoData.status === 'waitformp4' || videoData.status === 'mp4_processing') {
          console.log(`[Step 4a] Video ${videoUid} already in ${videoData.status} status, skipping enable-mp4 API call`);
          
          // Update processing details to show we checked again
          await supabase
            .from('clips')
            .update({
              processing_details: {
                ...(videoData.processing_details || {}),
                last_checked: new Date().toISOString(),
                status_message: `MP4 generation in progress (status: ${videoData.status})`
              }
            })
            .eq('cloudflare_uid', videoUid);
          
          return res.status(409).json({
            error: 'MP4 generation already in progress',
            status: videoData.status,
            message: 'Please check back later - MP4 generation is still in progress'
          });
        }

        const enableUrl = `${req.headers.origin || 'http://localhost:3000'}/api/cloudflare/enable-mp4`;
        console.log(`[Step 4a] Calling enable-mp4 API at: ${enableUrl}`);
        
        const enableResponse = await fetch(enableUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Referer': 'upload-to-r2'
          },
          body: JSON.stringify({ videoUid })
        });
        
        console.log(`[Step 4b] enable-mp4 API response status: ${enableResponse.status}`);
        const enableData = await enableResponse.json();
        console.log(`[Step 4c] enable-mp4 API response data:`, enableData);
        
        if (!enableResponse.ok || !enableData.mp4Url) {
          console.log('ERROR: Failed to enable MP4 download', enableData);
          
          await updateProcessingStatus(videoUid, 'error', {
            error_message: 'Failed to enable MP4 download',
            error_details: JSON.stringify(enableData)
          });
            
          return res.status(400).json({ 
            error: 'Failed to enable MP4 download', 
            details: enableData 
          });
        }
        
        // Update with the new MP4 URL
        console.log(`[Step 4d] Got MP4 download URL: ${enableData.mp4Url}`);
        mp4DownloadUrl = enableData.mp4Url;
      } catch (error) {
        console.log('ERROR: Failed to enable MP4 download', error);
        
        await updateProcessingStatus(videoUid, 'error', {
          error_message: 'Failed to enable MP4 download',
          error_details: error.message
        });
          
        return res.status(500).json({ 
          error: 'Failed to enable MP4 download',
          details: error.message
        });
      }
    }
    
    // Download the MP4 from Cloudflare
    console.log(`[Step 5] Downloading MP4 from Cloudflare`);
    
    // Set status to mp4downloading only if not already in that status
    if (videoData.status !== 'mp4downloading') {
      console.log(`[Step 5a] Setting status to mp4downloading (current: ${videoData.status})`);
      await updateProcessingStatus(videoUid, 'mp4downloading', {
        mp4_download_url: mp4DownloadUrl,
        mp4_download_started: true,
        mp4_download_start_time: new Date().toISOString(),
        mp4_processing: false,
        r2_upload_progress: 10
      });
    }
    
    const mp4Response = await fetch(mp4DownloadUrl);
    
    console.log(`[Step 5b] MP4 download response status: ${mp4Response.status}`);
    
    if (!mp4Response.ok) {
      console.log('ERROR: Failed to download MP4 from Cloudflare', { 
        status: mp4Response.status, 
        statusText: mp4Response.statusText 
      });
      
      await updateProcessingStatus(videoUid, 'error', {
        error_message: 'Failed to download MP4 from Cloudflare',
        error_status: mp4Response.status,
        error_text: mp4Response.statusText,
        mp4_download_failed: true,
        mp4_download_error_time: new Date().toISOString()
      });
        
      return res.status(500).json({
        error: 'Failed to download MP4 from Cloudflare',
        status: mp4Response.status,
        statusText: mp4Response.statusText
      });
    }
    
    // Get the video data as an ArrayBuffer
    console.log(`[Step 6] Converting MP4 response to buffer`);
    const mp4Buffer = await mp4Response.arrayBuffer();
    console.log(`[Step 6a] MP4 file size: ${mp4Buffer.byteLength} bytes`);
    
    // Update processing details with download completion info
    await supabase
      .from('clips')
      .update({
        processing_details: {
          ...(videoData.processing_details || {}),
          mp4_download_complete: true,
          mp4_download_complete_time: new Date().toISOString(),
          r2_download_complete: true,
          r2_download_size: mp4Buffer.byteLength,
          r2_upload_progress: 40,
          last_updated: new Date().toISOString()
        }
      })
      .eq('cloudflare_uid', videoUid);
    
    console.log(`[Step 6b] Updated processing details with download completion info`);
    
    // Generate a filename for R2 storage
    const username = videoData.username || 'user';
    const title = videoData.title ? videoData.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'untitled';
    const timestamp = Date.now();
    const fileName = `${username}_${title}_${timestamp}.mp4`;
    const filePath = `videos/${fileName}`;
    
    console.log(`[Step 7] Generated file path for R2: ${filePath}`);
    
    // Update details for R2 upload
    await supabase
      .from('clips')
      .update({
        processing_details: {
          ...(videoData.processing_details || {}),
          r2_upload_progress: 50,
          r2_upload_started: true,
          r2_file_path: filePath,
          last_updated: new Date().toISOString()
        }
      })
      .eq('cloudflare_uid', videoUid);
    
    console.log(`[Step 7a] Updated processing details for R2 upload`);
    
    // Upload to R2
    console.log(`[Step 8] Uploading to R2 bucket: ${R2_BUCKET_NAME}`);
    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
      Body: Buffer.from(mp4Buffer),
      ContentType: 'video/mp4',
      ACL: 'public-read'
    };
    
    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log(`[Step 8a] Upload to R2 successful`);
    
    // Get public URL
    const publicUrl = `${R2_PUBLIC_URL}/${filePath}`;
    console.log(`[Step 9] Generated public URL: ${publicUrl}`);
    
    // Update status to complete - this is the final status change
    const thumbnailUrl = await getThumbnailUrl(videoUid);
    await updateProcessingStatus(videoUid, 'complete', {
      r2_public_url: publicUrl,
      r2_file_path: filePath,
      r2_upload_complete: true,
      r2_upload_complete_time: new Date().toISOString(),
      mp4_download_url: mp4DownloadUrl,
      r2_upload_processing: false,
      thumbnail_url: thumbnailUrl,
      progress: 100
    });
    
    // Update the clips table with the mp4 link
    console.log(`[Step 10] Updating clips table with mp4link: ${publicUrl}`);
    const { error: updateClipError } = await supabase
      .from('clips')
      .update({
        mp4link: publicUrl,
        file_path: filePath,
        thumbnail_path: thumbnailUrl
      })
      .eq('cloudflare_uid', videoUid);
    
    if (updateClipError) {
      console.log('WARNING: Error updating clips table with mp4link:', updateClipError);
    } else {
      console.log(`[Step 10a] clips table updated successfully with mp4link and thumbnail`);
    }
    
    console.log('=== R2 UPLOAD PROCESS COMPLETED SUCCESSFULLY ===');
    return res.status(200).json({
      success: true,
      mp4Url: mp4DownloadUrl,
      r2Url: publicUrl,
      filePath: filePath
    });
  } catch (error) {
    console.log('=== R2 UPLOAD PROCESS FAILED ===', error);
    
    // Try to update error status if we have the videoUid
    if (req.body?.videoUid) {
      await updateProcessingStatus(req.body.videoUid, 'error', {
        error_message: error.message || 'Unknown error during R2 upload',
        error_details: error.stack,
        error_time: new Date().toISOString()
      });
    }
    
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.stack
    });
  }
}