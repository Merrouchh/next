import { createClient } from '@supabase/supabase-js';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Update the database with the current processing status
const updateProcessingStatus = async (videoUid, status, details = {}) => {
  try {
    console.log(`[MP4-Status] Updating status to: ${status}, details:`, details);
    
    // First check current status
    const { data: currentData } = await supabase
      .from('clips')
      .select('status')
      .eq('cloudflare_uid', videoUid)
      .single();
      
    if (currentData && currentData.status === status) {
      console.log(`[MP4-Status] Status already set to ${status}, only updating details`);
    } else if (currentData) {
      console.log(`[MP4-Status] Changing status from ${currentData.status} to ${status}`);
    }
    
    // Set appropriate flags based on status
    let updatedDetails = {
      ...details,
      mp4_processing: status === 'waitformp4' || status === 'mp4_processing',
      last_updated: new Date().toISOString()
    };
    
    // Update the clips table
    const { error: clipsError } = await supabase
      .from('clips')
      .update({
        status: status,
        processing_details: updatedDetails
      })
      .eq('cloudflare_uid', videoUid);
      
    if (clipsError) {
      console.log(`[MP4-Status] Warning: Failed to update clips table: ${clipsError.message}`);
      return false;
    } else {
      console.log(`[MP4-Status] Successfully updated clips table status to ${status}`);
      return true;
    }
  } catch (error) {
    console.log(`[MP4-Status] Error updating status: ${error.message}`);
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
        
        // Update processing details to show it was checked again without changing status
        await supabase
          .from('clips')
          .update({
            processing_details: {
              ...existingData.processing_details,
              last_checked: new Date().toISOString(),
              status_message: `MP4 generation in progress (status: ${existingData.status})`
            }
          })
          .eq('cloudflare_uid', videoUid);
        
        return res.status(202).json({ 
          message: 'MP4 generation already in progress',
          status: existingData.status,
          details: 'Continuing to process without changing status to prevent status cycling'
        });
      }
      
      // Otherwise, return that it's in progress
      return res.status(202).json({ message: 'MP4 processing in progress' });
    }

    // Update status to indicate MP4 processing has started
    await supabase
      .from('clips')
      .update({
        processing_details: {
          ...existingData.processing_details,
          mp4_processing_started: true,
          mp4_processing_started_at: new Date().toISOString()
        }
      })
      .eq('cloudflare_uid', videoUid);

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
        await updateProcessingStatus(videoUid, 'error', {
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
        await updateProcessingStatus(videoUid, 'error', {
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
        await updateProcessingStatus(videoUid, 'processing', {
          cloudflare_status: cloudflareStatus,
          progress: cfData.result?.status?.pctComplete || 0
        });
        return res.status(400).json({ 
          error: 'Video is not ready for MP4 download',
          status: cloudflareStatus,
          message: 'Video exists in Cloudflare but is not in ready state'
        });
      }
      
      // Update with the latest Cloudflare status - only if not already in a processing state
      // This prevents unnecessary status changes if we're already processing the MP4
      if (existingData.status !== 'mp4_processing' && existingData.status !== 'waitformp4') {
        console.log(`[MP4-Step 3f] Updating status to mp4_processing`);
        await updateProcessingStatus(videoUid, 'mp4_processing', {
          cloudflare_status: cloudflareStatus,
          ready_to_stream: true,
          progress: 100
        });
      } else {
        console.log(`[MP4-Step 3f] Not changing status as already in ${existingData.status} - preventing status cycling`);
        // Just update the processing details
        await supabase
          .from('clips')
          .update({
            processing_details: {
              ...existingData.processing_details,
              cloudflare_status: cloudflareStatus,
              ready_to_stream: true,
              progress: 100,
              last_checked: new Date().toISOString(),
              status_message: `Continuing MP4 process (current: ${existingData.status})`
            }
          })
          .eq('cloudflare_uid', videoUid);
      }
      
      // If we get here, the video is in 'ready' state in Cloudflare, so we proceed
      console.log(`[MP4-Step 3g] Cloudflare reports video is ready, proceeding with MP4 download`);
      
    } catch (error) {
      console.log(`[MP4-Step 3g] ERROR checking Cloudflare directly:`, error);
      await updateProcessingStatus(videoUid, 'error', {
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
      await updateProcessingStatus(videoUid, 'error', {
        error_message: data.errors?.[0]?.message || 'Failed to enable MP4 download',
        error_details: JSON.stringify(data.errors)
      });
      throw new Error(data.errors?.[0]?.message || 'Failed to enable MP4 download');
    }
    
    // Update status to show MP4 generation is in progress - only if not already in waitformp4
    if (existingData.status !== 'waitformp4' && existingData.status !== 'mp4_processing') {
      console.log(`[MP4-Step 5a] Updating status to waitformp4`);
      await updateProcessingStatus(videoUid, 'waitformp4', {
        mp4_status: 'polling',
        mp4_poll_started: true,
        mp4_poll_start_time: new Date().toISOString()
      });
    } else {
      console.log(`[MP4-Step 5a] Already in ${existingData.status} status, just updating details - preventing status cycling`);
      // Just update the processing details without changing the status
      await supabase
        .from('clips')
        .update({
          processing_details: {
            ...existingData.processing_details,
            mp4_status: 'polling',
            mp4_poll_started: true,
            last_checked: new Date().toISOString(),
            status_message: `MP4 polling process continuing (current: ${existingData.status})`
          }
        })
        .eq('cloudflare_uid', videoUid);
    }
    
    // Poll until the MP4 is ready (wait function with exponential backoff)
    console.log(`[MP4-Step 6] Waiting for MP4 to be ready`);
    const waitForMp4 = async (maxRetries = 10, initialDelay = 1000) => {
      let retries = 0;
      let delay = initialDelay;
      
      while (retries < maxRetries) {
        // Check MP4 status
        console.log(`[MP4-Step 6-${retries+1}] Checking MP4 status (attempt ${retries+1}/${maxRetries})`);
        const statusResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}/downloads`,
          {
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const statusData = await statusResponse.json();
        const mp4Status = statusData.result?.default?.status || 'pending';
        console.log(`[MP4-Step 6-${retries+1}a] Status response: ${mp4Status}`);
        
        // Update status in database with current MP4 generation progress
        await supabase
          .from('clips')
          .update({
            processing_details: {
              mp4_status: mp4Status,
              mp4_percent_complete: statusData.result?.default?.percentComplete || 0,
              last_poll_time: new Date().toISOString(),
              poll_attempt: retries + 1,
              mp4_poll_started: true,
              last_updated: new Date().toISOString()
            }
          })
          .eq('cloudflare_uid', videoUid);
        
        console.log(`[MP4-Step 6-${retries+1}b] Updated progress details (status: ${mp4Status}, attempt: ${retries+1})`);
        
        if (statusData.success && statusData.result?.default?.status === 'ready') {
          console.log(`[MP4-Step 6-complete] MP4 is ready! URL: ${statusData.result.default.url}`);
          return statusData.result.default;
        }
        
        // Exponential backoff
        const waitTime = Math.round(delay/1000);
        console.log(`[MP4-Step 6-${retries+1}b] MP4 not ready yet, waiting ${waitTime} seconds`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 10000); // Increase delay but cap at 10 seconds
        retries++;
      }
      
      console.log('ERROR: MP4 generation timed out after maximum retries');
      await updateProcessingStatus(videoUid, 'error', {
        error_message: 'MP4 generation timed out after maximum retries',
        mp4_status: 'timeout'
      });
      throw new Error('MP4 generation timed out');
    };
    
    // Wait for the MP4 to be ready (with timeout)
    const mp4Data = await waitForMp4();
    
    // Get the thumbnail URL
    const thumbnailUrl = await getThumbnailUrl(videoUid);
    
    // Check current status before updating to mp4downloading
    console.log(`[MP4-Step 7] Getting current status before finalizing MP4 process`);
    const { data: currentStatusData } = await supabase
      .from('clips')
      .select('status, processing_details')
      .eq('cloudflare_uid', videoUid)
      .single();
      
    // Define statuses that come after mp4downloading in the workflow
    const LATER_STATUSES = ['r2_uploading', 'complete'];
    
    // Only update to mp4downloading if we're not already in a later status
    if (currentStatusData && LATER_STATUSES.includes(currentStatusData.status)) {
      console.log(`[MP4-Step 7] Not changing status: current status (${currentStatusData.status}) is further in the workflow`);
      
      // Update processing details without changing status
      await supabase
        .from('clips')
        .update({
          processing_details: {
            ...(currentStatusData.processing_details || {}),
            mp4_download_url: mp4Data.url,
            mp4_ready: true,
            mp4_ready_time: new Date().toISOString(),
            mp4_status: 'ready',
            mp4_processing: false,
            r2_upload_pending: true,
            thumbnail_url: thumbnailUrl,
            last_checked: new Date().toISOString(),
            status_message: `MP4 ready but maintaining ${currentStatusData.status} status to prevent cycling`
          }
        })
        .eq('cloudflare_uid', videoUid);
    } else {
      // Update status with MP4 download URL and success
      console.log(`[MP4-Step 7] Setting status to mp4downloading`);
      await updateProcessingStatus(videoUid, 'mp4downloading', {
        mp4_download_url: mp4Data.url,
        mp4_ready: true,
        mp4_ready_time: new Date().toISOString(),
        mp4_status: 'ready',
        mp4_processing: false, // MP4 generation is complete
        r2_upload_pending: true, // Flag that R2 upload should happen next
        thumbnail_url: thumbnailUrl
      });
    }
    
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
      mp4Url: mp4Data.url,
      status: mp4Data.status,
      nextStep: 'r2_upload'
    });
  } catch (error) {
    console.error(`[ENABLE-MP4] Error processing ${videoUid}: ${error.message}`);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
} 