import { createClient } from '@supabase/supabase-js';

// Environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'clips.merrouchgaming.com';

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
 * Check MP4 status from Cloudflare
 * @param {string} videoUid - Cloudflare video UID
 * @returns {Promise<{status: string, url: string, percentComplete: number}>} MP4 status info
 */
async function checkMp4Status(videoUid) {
  try {
    console.log(`[MP4-Check] Checking MP4 status for video ${videoUid}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}/downloads`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.log(`[MP4-Check] Error checking MP4 status: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to check MP4 status: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      console.log(`[MP4-Check] Cloudflare API error:`, data.errors);
      throw new Error('Cloudflare API error: ' + JSON.stringify(data.errors));
    }
    
    const mp4Info = data.result?.default || {};
    console.log(`[MP4-Check] MP4 status: ${mp4Info.status}, progress: ${mp4Info.percentComplete}%`);
    
    return {
      status: mp4Info.status || 'unknown',
      url: mp4Info.url,
      percentComplete: mp4Info.percentComplete || 0
    };
  } catch (error) {
    console.error(`[MP4-Check] Error checking MP4 status: ${error.message}`);
    throw error;
  }
}

/**
 * Triggers the R2 upload process
 * @param {string} videoUid - Cloudflare video UID
 * @returns {Promise<{status: number}>} Upload response status
 */
async function triggerR2Upload(videoUid) {
  console.log(`[MP4] 🚀 Triggering R2 upload for ${videoUid}`);
  
  try {
    const r2Response = await fetch('http://localhost:3000/api/cloudflare/upload-to-r2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Source': 'enable-mp4'
      },
      body: JSON.stringify({ videoUid })
    });
    
    console.log(`[MP4] ✅ R2 upload triggered successfully, status: ${r2Response.status}`);
    return { status: r2Response.status };
  } catch (error) {
    console.error(`[MP4] ❌ Error triggering R2 upload: ${error.message}`);
    throw error;
  }
}

/**
 * Updates the database with an error status
 * @param {string} videoUid - Cloudflare video UID
 * @param {string} errorMessage - Error message
 */
async function updateErrorStatus(videoUid, errorMessage) {
  try {
    await supabase
      .from('clips')
      .update({
        status: 'error',
        error_message: errorMessage
      })
      .eq('cloudflare_uid', videoUid);
  } catch (error) {
    console.error(`[MP4] Error updating database with error status: ${error.message}`);
  }
}

/**
 * API handler for enabling MP4 processing
 */
export default async function handler(req, res) {
  // Step 1: Validate request method
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { videoUid } = req.body;
  const source = req.headers.source || 'unknown';
  const requestId = Math.random().toString(36).substring(2, 15);

  console.log(`[ENABLE-MP4-${requestId}] 🚀 Starting MP4 process for ${videoUid}. Source: ${source}`);

  // Step 2: Validate videoUid
  if (!videoUid) {
    console.error('[ENABLE-MP4] ❌ No videoUid provided');
    return res.status(400).json({ message: 'videoUid is required' });
  }

  try {
    // Step 3: Check if video exists in database
    const { data: existingData, error: dbError } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();

    if (dbError || !existingData) {
      console.error(`[ENABLE-MP4-${requestId}] ❌ Video ${videoUid} not found in database`);
      return res.status(404).json({ message: 'Video not found', requestId });
    }

    // Step 4: Get current status and check if already processed
    const currentStatus = existingData.status;
    console.log(`[ENABLE-MP4-${requestId}] 📊 Video current status: ${currentStatus}`);

    // Step 5: Skip if already in MP4 processing or beyond
    if (['mp4_processing', 'mp4_downloading', 'r2_uploading', 'complete'].includes(currentStatus)) {
      console.log(`[ENABLE-MP4-${requestId}] ✓ Video ${videoUid} already in ${currentStatus} status, skipping`);
      return res.status(200).json({ 
        message: `Video already in ${currentStatus} status`,
        status: currentStatus,
        requestId
      });
    }

    // Step 6: Check Cloudflare status if not ready_to_stream
    if (currentStatus !== 'ready_to_stream') {
      console.log(`[ENABLE-MP4-${requestId}] ⚠️ Video ${videoUid} is not in ready_to_stream status (current: ${currentStatus})`);
      
      // Step 6a: Check Cloudflare API for video status
      console.log(`[MP4-${requestId}] 🔍 Checking Cloudflare API for video: ${videoUid}`);
      
      const cloudflareResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Step 6b: Handle Cloudflare API errors
      if (!cloudflareResponse.ok) {
        console.log(`[MP4-${requestId}] ❌ Cloudflare API error: ${cloudflareResponse.status}`);
        
        if (cloudflareResponse.status === 404) {
          await updateErrorStatus(videoUid, 'Video not found in Cloudflare');
          return res.status(404).json({ message: 'Video not found in Cloudflare', requestId });
        }
        
        return res.status(cloudflareResponse.status).json({ message: 'Error checking Cloudflare status', requestId });
      }
      
      // Step 6c: Check if video is ready in Cloudflare
      const cfData = await cloudflareResponse.json();
      const cloudflareStatus = cfData.result?.status?.state;
      
      console.log(`[MP4-${requestId}] 📊 Cloudflare status: ${cloudflareStatus}`);
      
      if (cloudflareStatus !== 'ready') {
        console.log(`[MP4-${requestId}] ⚠️ Video is not ready in Cloudflare: ${cloudflareStatus}`);
        return res.status(400).json({ 
          message: 'Video is not ready for MP4 processing',
          cloudflareStatus,
          requestId
        });
      }
    }
    
    // Step 7: Update status to mp4_processing
    console.log(`[MP4-${requestId}] ⚠️ Updating status to mp4_processing`);
    await supabase
      .from('clips')
      .update({
        status: 'mp4_processing'
      })
      .eq('cloudflare_uid', videoUid);
    
    // Step 8: Request MP4 from Cloudflare
    console.log(`[MP4-${requestId}] 📥 Requesting MP4 from Cloudflare API`);
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
    
    // Step 9: Handle MP4 request errors
    if (!mp4Response.ok) {
      console.log(`[MP4-${requestId}] ❌ Error requesting MP4: ${mp4Response.status}`);
      await updateErrorStatus(videoUid, 'Failed to request MP4 from Cloudflare');
      return res.status(mp4Response.status).json({ message: 'Failed to request MP4 from Cloudflare', requestId });
    }
    
    // Step 10: Process MP4 response
    const mp4Data = await mp4Response.json();
    console.log(`[MP4-${requestId}] 📄 MP4 request response received`);
    
    if (!mp4Data.success) {
      console.log(`[MP4-${requestId}] ❌ Cloudflare API error:`, mp4Data.errors);
      await updateErrorStatus(videoUid, 'Failed to request MP4: ' + JSON.stringify(mp4Data.errors));
      return res.status(400).json({ message: 'Cloudflare API error', errors: mp4Data.errors, requestId });
    }
    
    // Step 11: Get MP4 status and URL
    const mp4Status = mp4Data.result?.default?.status || 'unknown';
    const mp4Url = mp4Data.result?.default?.url;
    
    console.log(`[MP4-${requestId}] 📊 MP4 status: ${mp4Status}, URL: ${mp4Url ? 'Available' : 'Not available'}`);
    
    // Step 12: Get thumbnail URL
    const thumbnailUrl = await getThumbnailUrl(videoUid);
    
    // Step 13: Handle immediate MP4 ready case
    if (mp4Status === 'ready' && mp4Url) {
      console.log(`[MP4-${requestId}] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
      console.log(`[MP4-${requestId}] ✅ MP4 is already READY!`);
      console.log(`[MP4-${requestId}] ⚠️ Updating status to mp4_downloading`);
      
      await supabase
        .from('clips')
        .update({ 
          status: 'mp4_downloading',
          mp4link: mp4Url
        })
        .eq('cloudflare_uid', videoUid);
        
      console.log(`[MP4-${requestId}] ✅ Updated status to mp4_downloading`);
      console.log(`[MP4-${requestId}] 🚀 Will trigger R2 upload next`);
      
      // Step 14: Trigger R2 upload
      try {
        await triggerR2Upload(videoUid);
        
        // Just trigger R2 upload and continue - don't wait for it to complete
        // R2 upload will handle its own status updates
        console.log(`[MP4-${requestId}] ✅ R2 upload initiated successfully`);
        console.log(`[MP4-${requestId}] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
        return res.status(200).json({
          message: 'MP4 is ready, R2 upload triggered',
          status: 'mp4_downloading',
          mp4Url: mp4Url,
          requestId
        });
      } catch (r2Error) {
        console.log(`[MP4-${requestId}] ❌ Error triggering R2 upload: ${r2Error.message}`);
        await updateErrorStatus(videoUid, `Failed to trigger R2 upload: ${r2Error.message}`);
        return res.status(500).json({
          message: 'Failed to trigger R2 upload',
          error: r2Error.message,
          requestId
        });
      }
    }
    
    // Step 15: Start polling for MP4 status
    console.log(`[MP4-${requestId}] ⏳ MP4 is being processed (${mp4Status}), starting status polling`);
    
    // Step 16: Update with available info
    await supabase
      .from('clips')
      .update({
        mp4link: mp4Url,
        thumbnail_url: thumbnailUrl,
        thumbnail_path: thumbnailUrl
      })
      .eq('cloudflare_uid', videoUid);
    
    // Step 17: Poll for MP4 status
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum (5 seconds * 60)
    
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
      
      try {
        const mp4Info = await checkMp4Status(videoUid);
        
        // Step 18: Handle MP4 ready case
        if (mp4Info.status === 'ready' && mp4Info.url) {
          console.log(`[MP4-${requestId}] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
          console.log(`[MP4-${requestId}] ✅ MP4 is ready after ${attempts} attempts!`);
          console.log(`[MP4-${requestId}] ⚠️ Updating status to mp4_downloading`);
          
          await supabase
            .from('clips')
            .update({ 
              status: 'mp4_downloading',
              mp4link: mp4Info.url
            })
            .eq('cloudflare_uid', videoUid);
            
          console.log(`[MP4-${requestId}] ✅ Updated status to mp4_downloading`);
          console.log(`[MP4-${requestId}] 🚀 Will trigger R2 upload next`);
          
          // Step 19: Trigger R2 upload
          try {
            await triggerR2Upload(videoUid);
            
            // Just trigger R2 upload and continue - don't wait for it to complete
            // R2 upload will handle its own status updates
            console.log(`[MP4-${requestId}] ✅ R2 upload initiated successfully`);
            console.log(`[MP4-${requestId}] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
            return res.status(200).json({
              message: 'MP4 is ready, R2 upload triggered',
              status: 'mp4_downloading',
              mp4Url: mp4Info.url,
              requestId
            });
          } catch (r2Error) {
            console.log(`[MP4-${requestId}] ❌ Error triggering R2 upload: ${r2Error.message}`);
            await updateErrorStatus(videoUid, `Failed to trigger R2 upload: ${r2Error.message}`);
            return res.status(500).json({
              message: 'Failed to trigger R2 upload',
              error: r2Error.message,
              requestId
            });
          }
        }
        
        console.log(`[MP4-${requestId}] ⏳ MP4 still processing (${mp4Info.status}, ${mp4Info.percentComplete}%)`);
      } catch (error) {
        console.error(`[MP4-${requestId}] ❌ Error checking MP4 status: ${error.message}`);
        // Continue polling despite errors
      }
    }
    
    // Step 20: Handle timeout case
    console.log(`[MP4-${requestId}] ⏱️ MP4 not ready after ${maxAttempts} attempts, giving up`);
    await updateErrorStatus(videoUid, 'MP4 processing timed out');
    
    return res.status(408).json({
      message: 'MP4 processing timed out',
      status: 'error',
      requestId
    });
  } catch (error) {
    // Step 21: Handle general errors
    console.error(`[ENABLE-MP4-${requestId}] ❌ Error processing ${videoUid}: ${error.message}`);
    return res.status(500).json({ message: 'Server error', error: error.message, requestId });
  }
} 