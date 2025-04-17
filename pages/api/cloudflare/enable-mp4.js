import { createClient } from '@supabase/supabase-js';
import { 
  getStatusMessage,
  getMinProgressForStatus
} from '../../../CloudFlareStreamProgressDataUpdate/src/statusUtils.js';

// Configuration constants
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Gets the thumbnail URL for a video from Cloudflare
 * @param {string} videoUid - Cloudflare video UID
 * @returns {Promise<string|null>} Thumbnail URL or null if not found
 */
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

/**
 * Signal for a status update in the database
 * @param {string} videoUid - Cloudflare video UID
 * @param {string} requestedStatus - The status to request
 * @returns {Promise<boolean>} Success indicator
 */
async function signalStatusUpdate(videoUid, requestedStatus) {
  try {
    console.log(`[ENABLE-MP4] Signaling status update: ${requestedStatus} for ${videoUid}`);
    
    const { error } = await supabase
      .from('clips')
      .update({
        requested_status: requestedStatus,
        requested_status_at: new Date().toISOString()
      })
      .eq('cloudflare_uid', videoUid);
      
    if (error) {
      console.error(`[ENABLE-MP4] Error signaling status update: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`[ENABLE-MP4] Exception signaling status update: ${error.message}`);
    return false;
  }
}

/**
 * API handler for enabling MP4 processing
 */
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
    // Check if video exists and get current status
    const { data: existingData } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();

    if (!existingData) {
      console.error(`[ENABLE-MP4] Video ${videoUid} not found in database`);
      return res.status(404).json({ message: 'Video not found' });
    }

    // Get current status
    const currentStatus = existingData.status;
    console.log(`[ENABLE-MP4] Video current status: ${currentStatus}`);

    // If already in MP4 processing or beyond, return success
    if (['waitformp4', 'mp4_processing', 'mp4downloading', 'r2_uploading', 'complete'].includes(currentStatus)) {
      console.log(`[ENABLE-MP4] Video ${videoUid} is already in ${currentStatus} status, no need to process again`);
      return res.status(200).json({ 
        message: `Video already in ${currentStatus} status`,
        status: currentStatus
      });
    }

    // If not in stream_ready status, check with Cloudflare
    if (currentStatus !== 'stream_ready') {
      console.log(`[ENABLE-MP4] Video ${videoUid} is not in stream_ready status (current: ${currentStatus})`);
      
      // Check with Cloudflare to see if it's ready
      console.log(`[MP4-Step 1] Checking Cloudflare API for video: ${videoUid}`);
      
      const cloudflareResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!cloudflareResponse.ok) {
        console.log(`[MP4-Step 1a] Cloudflare API error: ${cloudflareResponse.status}`);
        
        if (cloudflareResponse.status === 404) {
          // Update database with error status
          await supabase
            .from('clips')
            .update({
              status: 'error',
              error_message: 'Video not found in Cloudflare'
            })
            .eq('cloudflare_uid', videoUid);
            
          return res.status(404).json({ message: 'Video not found in Cloudflare' });
        }
        
        return res.status(cloudflareResponse.status).json({ message: 'Error checking Cloudflare status' });
      }
      
      const cfData = await cloudflareResponse.json();
      const cloudflareStatus = cfData.result?.status?.state;
      
      console.log(`[MP4-Step 1b] Cloudflare status: ${cloudflareStatus}`);
      
      // If not ready in Cloudflare, return error
      if (cloudflareStatus !== 'ready') {
        console.log(`[MP4-Step 1c] Video is not ready in Cloudflare: ${cloudflareStatus}`);
        return res.status(400).json({ 
          message: 'Video is not ready for MP4 processing',
          cloudflareStatus: cloudflareStatus
        });
      }
      
      // Update status to stream_ready first
      console.log(`[MP4-Step 1d] Updating status to stream_ready`);
      await supabase
        .from('clips')
        .update({
          status: 'stream_ready',
          status_message: getStatusMessage('stream_ready'),
          progress: getMinProgressForStatus('stream_ready')
        })
        .eq('cloudflare_uid', videoUid);
    }
    
    // Signal for status update to waitformp4 instead of directly changing it
    console.log(`[MP4-Step 2] Signaling status update to waitformp4`);
    await signalStatusUpdate(videoUid, 'waitformp4');
    
    // Update progress and message
    await supabase
      .from('clips')
      .update({
        status_message: getStatusMessage('waitformp4'),
        progress: getMinProgressForStatus('waitformp4'),
        mp4_started_at: new Date().toISOString()
      })
      .eq('cloudflare_uid', videoUid);
    
    // Request MP4 from Cloudflare
    console.log(`[MP4-Step 3] Requesting MP4 from Cloudflare API`);
    const mp4Response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}/downloads`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!mp4Response.ok) {
      console.log(`[MP4-Step 3a] Error requesting MP4: ${mp4Response.status}`);
      
      // Update with error status
      await supabase
        .from('clips')
        .update({
          status: 'error',
          error_message: 'Failed to request MP4 from Cloudflare'
        })
        .eq('cloudflare_uid', videoUid);
        
      return res.status(mp4Response.status).json({ message: 'Failed to request MP4 from Cloudflare' });
    }
    
    const mp4Data = await mp4Response.json();
    console.log(`[MP4-Step 3b] MP4 request response:`, mp4Data);
    
    if (!mp4Data.success) {
      console.log(`[MP4-Step 3c] Cloudflare API error:`, mp4Data.errors);
      
      // Update with error status
      await supabase
        .from('clips')
        .update({
          status: 'error',
          error_message: 'Failed to request MP4: ' + JSON.stringify(mp4Data.errors)
        })
        .eq('cloudflare_uid', videoUid);
        
      return res.status(400).json({ message: 'Cloudflare API error', errors: mp4Data.errors });
    }
    
    // Get the MP4 status and URL
    const mp4Status = mp4Data.result?.default?.status || 'unknown';
    const mp4Url = mp4Data.result?.default?.url;
    const mp4Progress = mp4Data.result?.default?.percentComplete || 0;
    
    console.log(`[MP4-Step 3d] MP4 status: ${mp4Status}, progress: ${mp4Progress}%, URL: ${mp4Url}`);
    
    // Get thumbnail URL
    const thumbnailUrl = await getThumbnailUrl(videoUid);
    
    // If MP4 is ready immediately (rare, but possible), signal for mp4downloading
    if (mp4Status === 'ready' && mp4Url) {
      console.log(`[MP4-Step 4] MP4 is already ready, signaling status update to mp4downloading`);
      
      await signalStatusUpdate(videoUid, 'mp4downloading');
      
      // Update status-related fields
      await supabase
        .from('clips')
        .update({
          status_message: getStatusMessage('mp4downloading'),
          progress: getMinProgressForStatus('mp4downloading'),
          mp4_download_url: mp4Url,
          mp4_ready_at: new Date().toISOString(),
          thumbnail_url: thumbnailUrl,
          mp4_status: mp4Status,
          mp4_percent: mp4Progress,
          mp4_url: mp4Url
        })
        .eq('cloudflare_uid', videoUid);
        
      // Update thumbnail in clips table
      if (thumbnailUrl) {
        await supabase
          .from('clips')
          .update({ thumbnail_url: thumbnailUrl, thumbnail_path: thumbnailUrl })
          .eq('cloudflare_uid', videoUid);
      }
        
      console.log(`[MP4-Step 4a] Updated status message to mp4downloading, will trigger R2 upload next`);
      
      // We'll trigger the upload-to-r2 endpoint to handle the next step
      try {
        const r2Response = await fetch('http://localhost:3000/api/cloudflare/upload-to-r2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Source': 'enable-mp4'
          },
          body: JSON.stringify({ videoUid })
        });
        
        console.log(`[MP4-Step 4b] R2 upload triggered, status: ${r2Response.status}`);
      } catch (r2Error) {
        console.log(`[MP4-Step 4c] Error triggering R2 upload: ${r2Error.message}`);
      }
      
      return res.status(200).json({
        message: 'MP4 is ready, triggered R2 upload',
        status: 'mp4downloading',
        mp4Url: mp4Url
      });
    }
    
    // Otherwise, leave in waitformp4 status and let poll-mp4-status handle it
    console.log(`[MP4-Step 5] MP4 is being processed (${mp4Status}), leaving status signal as waitformp4`);
    
    // Update with any available info but keep status signal as waitformp4
    await supabase
      .from('clips')
      .update({
        mp4_status: mp4Status,
        mp4_percent: mp4Progress,
        mp4_url: mp4Url,
        progress: Math.max(getMinProgressForStatus('waitformp4'), mp4Progress),
        status_message: `Creating MP4 version (${mp4Status})...`,
        thumbnail_url: thumbnailUrl
      })
      .eq('cloudflare_uid', videoUid);
      
    // Update thumbnail in clips table
    if (thumbnailUrl) {
      await supabase
        .from('clips')
        .update({ thumbnail_url: thumbnailUrl, thumbnail_path: thumbnailUrl })
        .eq('cloudflare_uid', videoUid);
    }
    
    console.log('=== ENABLE MP4 PROCESS COMPLETED SUCCESSFULLY ===');
    return res.status(200).json({
      message: 'MP4 generation started',
      status: mp4Status,
      mp4Url: mp4Url
    });
  } catch (error) {
    console.error(`[ENABLE-MP4] Error processing ${videoUid}: ${error.message}`);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
} 