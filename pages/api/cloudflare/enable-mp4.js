import { createClient } from '@supabase/supabase-js';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Update ONLY the processing_details without changing status
// This avoids status cycling by letting the main index.js handle all status changes
const updateProcessingDetails = async (videoUid, details = {}) => {
  try {
    console.log(`[MP4-Details] Updating processing details:`, details);
    
    // First get current data
    const { data: currentData } = await supabase
      .from('clips')
      .select('processing_details')
      .eq('cloudflare_uid', videoUid)
      .single();
      
    if (!currentData) {
      console.log(`[MP4-Details] Warning: Video ${videoUid} not found in database`);
      return false;
    }
    
    // Merge with existing details
    const updatedDetails = {
      ...(currentData.processing_details || {}),
      ...details,
      last_updated: new Date().toISOString()
    };
    
    // Update ONLY the processing_details field
    const { error: updateError } = await supabase
      .from('clips')
      .update({
        processing_details: updatedDetails
      })
      .eq('cloudflare_uid', videoUid);
      
    if (updateError) {
      console.log(`[MP4-Details] Warning: Failed to update processing details: ${updateError.message}`);
      return false;
    } else {
      console.log(`[MP4-Details] Successfully updated processing details`);
      return true;
    }
  } catch (error) {
    console.log(`[MP4-Details] Error updating details: ${error.message}`);
    return false;
  }
};

// Signal that we need a status update
// This adds flags to trigger index.js to update the status accordingly
const signalStatusUpdate = async (videoUid, nextStatus, details = {}) => {
  try {
    console.log(`[MP4-Signal] Signaling for status update to: ${nextStatus}`);
    
    // Set the flag for the requested status update
    const updateDetails = {
      ...details,
      requested_status: nextStatus,
      status_request_time: new Date().toISOString()
    };
    
    return await updateProcessingDetails(videoUid, updateDetails);
  } catch (error) {
    console.log(`[MP4-Signal] Error signaling status update: ${error.message}`);
    return false;
  }
};

// Get thumbnail URL for the video
async function getThumbnailUrl(videoUid) {
  try {
    console.log(`[MP4-Step 7] Getting thumbnail URL for video ${videoUid}`);
    
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
      console.log(`[MP4-Step 7a] Failed to get thumbnail info: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.result && data.result.thumbnail) {
      console.log(`[MP4-Step 7b] Found thumbnail URL: ${data.result.thumbnail}`);
      return data.result.thumbnail;
    } else {
      console.log(`[MP4-Step 7c] No thumbnail URL found in Cloudflare response`);
      return null;
    }
  } catch (error) {
    console.log(`[MP4-Step 7d] Error getting thumbnail URL: ${error.message}`);
    return null;
  }
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { videoUid } = req.body;
  const source = req.headers.source || 'unknown';

  console.log(`[ENABLE-MP4] Starting MP4 process for ${videoUid}. Source: ${source}`);

  if (!videoUid) {
    console.error('[ENABLE-MP4] No videoUid provided');
    return res.status(400).json({ message: 'videoUid is required' });
  }

  try {
    // Check if already being processed to avoid duplicates
    const { data: existingData } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();

    if (!existingData) {
      console.error(`[ENABLE-MP4] Video ${videoUid} not found in database`);
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if MP4 processing has already started
    if (existingData.processing_details?.mp4_processing_started) {
      console.log(`[ENABLE-MP4] MP4 processing already started for ${videoUid}, skipping`);
      
      // If MP4 is already complete, return it
      if (existingData.processing_details?.mp4_download_url) {
        console.log(`[ENABLE-MP4] MP4 already available for ${videoUid}`);
        return res.status(200).json({ 
          message: 'MP4 already processed',
          mp4Url: existingData.processing_details.mp4_download_url 
        });
      }
      
      // If the video is already in waitformp4 or mp4_processing status, return immediately
      // This prevents cycling between statuses when called multiple times
      if (existingData.status === 'waitformp4' || existingData.status === 'mp4_processing') {
        console.log(`[ENABLE-MP4] Video ${videoUid} already in ${existingData.status} status, skipping status changes`);
        
        // Update only processing_details to show it was checked again without changing status
        await updateProcessingDetails(videoUid, {
          last_checked: new Date().toISOString(),
          status_message: `MP4 generation in progress (status: ${existingData.status})`
        });
        
        return res.status(202).json({ 
          message: 'MP4 generation already in progress',
          status: existingData.status,
          details: 'Continuing to process without changing status to prevent status cycling'
        });
      }
      
      // Otherwise, return that it's in progress
      return res.status(202).json({ message: 'MP4 processing in progress' });
    }

    // Mark MP4 processing as started but don't change status directly
    await updateProcessingDetails(videoUid, {
      mp4_processing_started: true,
      mp4_processing_started_at: new Date().toISOString(),
      status_message: 'Starting MP4 creation process'
    });

    console.log(`[ENABLE-MP4] MP4 processing started for ${videoUid}`);

    // Check with Cloudflare to see if the video is ready
    console.log(`[MP4-Step 3] Directly checking Cloudflare API for video: ${videoUid}`);
    let cloudflareStatus = 'unknown';
    
    try {
      const cloudflareResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[MP4-Step 3a] Cloudflare API status: ${cloudflareResponse.status}`);
      
      if (cloudflareResponse.status === 404) {
        console.log(`[MP4-Step 3b] ERROR: Video ${videoUid} not found in Cloudflare`);
        await signalStatusUpdate(videoUid, 'error', {
          error_message: 'Video not found in Cloudflare - possible upload failure',
          error_details: `Cloudflare API returned 404 for UID: ${videoUid}`,
          error_time: new Date().toISOString()
        });
        return res.status(400).json({ 
          error: 'Video does not exist in Cloudflare',
          message: 'The video was not found in Cloudflare - the upload may have failed'
        });
      }
      
      const cfData = await cloudflareResponse.json();
      cloudflareStatus = cfData.result?.status?.state || 'unknown';
      
      console.log(`[MP4-Step 3c] Cloudflare direct check response:`, {
        status: cloudflareStatus,
        success: cfData.success,
        responseStatus: cloudflareResponse.status
      });
      
      if (!cfData.success) {
        console.log(`[MP4-Step 3d] ERROR: Failed to get video info from Cloudflare`);
        await signalStatusUpdate(videoUid, 'error', {
          error_message: 'Failed to get video info from Cloudflare',
          error_details: JSON.stringify(cfData.errors)
        });
        return res.status(400).json({ 
          error: 'Failed to get video info from Cloudflare',
          details: cfData.errors
        });
      }
      
      if (cfData.result?.status?.state !== 'ready') {
        console.log(`[MP4-Step 3e] Video exists in Cloudflare but not ready: ${cloudflareStatus}`);
        await signalStatusUpdate(videoUid, 'processing', {
          cloudflare_status: cloudflareStatus,
          progress: cfData.result?.status?.pctComplete || 0
        });
        return res.status(400).json({ 
          error: 'Video is not ready for MP4 download',
          status: cloudflareStatus,
          message: 'Video exists in Cloudflare but is not in ready state'
        });
      }
      
      // Signal to start MP4 processing
      console.log(`[MP4-Step 3f] Signaling to start waitformp4 status`);
      await signalStatusUpdate(videoUid, 'waitformp4', {
        cloudflare_status: cloudflareStatus,
        ready_to_stream: true,
        progress: 70,
        mp4_status: 'initializing',
        status_message: 'Starting MP4 creation'
      });
      
      // If we get here, the video is in 'ready' state in Cloudflare, so we proceed
      console.log(`[MP4-Step 3g] Cloudflare reports video is ready, proceeding with MP4 download`);
      
    } catch (error) {
      console.log(`[MP4-Step 3g] ERROR checking Cloudflare directly:`, error);
      await signalStatusUpdate(videoUid, 'error', {
        error_message: `Error checking Cloudflare API: ${error.message}`,
        error_time: new Date().toISOString()
      });
      throw error;
    }
    
    // Enable MP4 downloads via Cloudflare API
    console.log(`[MP4-Step 4] Enabling MP4 downloads via Cloudflare API`);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}/downloads`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    console.log(`[MP4-Step 5] Cloudflare API response:`, data);
    
    if (!data.success) {
      console.log('ERROR: Failed to enable MP4 download', data.errors);
      await signalStatusUpdate(videoUid, 'error', {
        error_message: data.errors?.[0]?.message || 'Failed to enable MP4 download',
        error_details: JSON.stringify(data.errors)
      });
      throw new Error(data.errors?.[0]?.message || 'Failed to enable MP4 download');
    }
    
    // Get the thumbnail URL
    const thumbnailUrl = await getThumbnailUrl(videoUid);
    
    // Update status with MP4 download URL and success
    await updateProcessingDetails(videoUid, {
      mp4_download_url: data.result.default.url,
      mp4_ready: true,
      mp4_ready_time: new Date().toISOString(),
      mp4_status: 'ready',
      mp4_processing: false, // MP4 generation is complete
      r2_upload_pending: true, // Flag that R2 upload should happen next
      thumbnail_url: thumbnailUrl
    });
    
    // Update clips table with thumbnail if available
    if (thumbnailUrl) {
      console.log(`[MP4-Step 8] Updating clips table with thumbnail: ${thumbnailUrl}`);
      const { error: updateThumbnailError } = await supabase
        .from('clips')
        .update({
          thumbnail_path: thumbnailUrl,
          thumbnail_url: thumbnailUrl
        })
        .eq('cloudflare_uid', videoUid);
        
      if (updateThumbnailError) {
        console.log(`[MP4-Step 8a] Error updating thumbnail: ${updateThumbnailError.message}`);
      } else {
        console.log(`[MP4-Step 8b] Successfully updated thumbnail`);
      }
    }
    
    console.log('=== ENABLE MP4 PROCESS COMPLETED SUCCESSFULLY ===');
    return res.status(200).json({
      success: true,
      mp4Url: data.result.default.url,
      status: data.result.default.status,
      nextStep: 'r2_upload'
    });
  } catch (error) {
    console.error(`[ENABLE-MP4] Error processing ${videoUid}: ${error.message}`);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
} 