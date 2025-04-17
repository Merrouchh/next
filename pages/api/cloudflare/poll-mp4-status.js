import { createClient } from '@supabase/supabase-js';
import { getStatusMessage, getMinProgressForStatus } from '../../../CloudFlareStreamProgressDataUpdate/src/statusUtils.js';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * API endpoint to poll MP4 status from Cloudflare
 * 
 * This endpoint checks the status of MP4 generation for videos in the 'waitformp4' state
 * and changes status to 'mp4downloading' when the MP4 is ready.
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Support both specific videoUid and fetching from database
  const { videoUid } = req.body;
  const source = req.headers.source || 'unknown';

  try {
    // If a specific videoUid is provided, check just that video
    if (videoUid) {
      console.log(`[POLL-MP4] Checking MP4 status for specific video: ${videoUid}. Source: ${source}`);
      const result = await checkMp4Status(videoUid);
      return res.status(200).json(result);
    }

    // Otherwise, fetch all videos in waitformp4 status
    console.log(`[POLL-MP4] Checking MP4 status for all pending videos. Source: ${source}`);
    
    const { data: pendingVideos, error } = await supabase
      .from('clips')
      .select('*')
      .eq('status', 'waitformp4')
      .order('uploaded_at', { ascending: true })
      .limit(5); // Process a few at a time
    
    if (error) {
      console.error(`[POLL-MP4] Error fetching pending videos: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch pending videos' });
    }
    
    if (!pendingVideos || pendingVideos.length === 0) {
      console.log(`[POLL-MP4] No videos in waitformp4 status found`);
      return res.status(200).json({ message: 'No videos to check' });
    }
    
    console.log(`[POLL-MP4] Found ${pendingVideos.length} videos in waitformp4 status`);
    
    // Process each video
    const results = [];
    for (const video of pendingVideos) {
      const result = await checkMp4Status(video.cloudflare_uid);
      results.push({
        videoUid: video.cloudflare_uid,
        status: result.status,
        details: result
      });
    }
    
    return res.status(200).json({
      message: `Processed ${results.length} videos`,
      results
    });
    
  } catch (error) {
    console.error(`[POLL-MP4] Error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Check the status of MP4 generation for a specific video
 * 
 * @param {string} videoUid - Cloudflare video UID
 * @returns {object} Status information
 */
async function checkMp4Status(videoUid) {
  try {
    console.log(`[POLL-MP4] Checking status for video ${videoUid}`);
    
    // First check if the video exists and is in waitformp4 status
    const { data: video, error } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();
    
    if (error) {
      console.error(`[POLL-MP4] Error fetching video ${videoUid}: ${error.message}`);
      return { status: 'error', message: `Failed to fetch video: ${error.message}` };
    }
    
    if (!video) {
      console.log(`[POLL-MP4] Video ${videoUid} not found in database`);
      return { status: 'not_found', message: 'Video not found' };
    }
    
    // If the video is not in waitformp4 status, skip it
    if (video.status !== 'waitformp4') {
      console.log(`[POLL-MP4] Video ${videoUid} is not in waitformp4 status (current: ${video.status})`);
      return { 
        status: 'skipped', 
        message: `Video is in ${video.status} status, not waitformp4`,
        currentStatus: video.status
      };
    }
    
    // Check MP4 status with Cloudflare
    console.log(`[POLL-MP4] Checking MP4 status with Cloudflare for ${videoUid}`);
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
      console.log(`[POLL-MP4] Error fetching MP4 status from Cloudflare: ${response.status} ${response.statusText}`);
      
      // If the error is 404, the video may have been deleted
      if (response.status === 404) {
        // Update error status
        await supabase
          .from('clips')
          .update({
            status: 'error',
            error_message: 'Video not found in Cloudflare'
          })
          .eq('cloudflare_uid', videoUid);
        
        return { 
          status: 'error', 
          message: 'Video not found in Cloudflare', 
          httpStatus: response.status 
        };
      }
      
      // Update with error info
      await supabase
        .from('clips')
        .update({
          error_message: `Failed to get MP4 status: ${response.statusText}`
        })
        .eq('cloudflare_uid', videoUid);
      
      return { 
        status: 'error', 
        message: `Failed to get MP4 status: ${response.statusText}`, 
        httpStatus: response.status 
      };
    }
    
    const data = await response.json();
    console.log(`[POLL-MP4] Cloudflare MP4 status response:`, data);
    
    if (!data.success) {
      console.log(`[POLL-MP4] Cloudflare API error:`, data.errors);
      
      // Update with error info
      await supabase
        .from('clips')
        .update({
          error_message: data.errors?.[0]?.message || 'Unknown API error'
        })
        .eq('cloudflare_uid', videoUid);
      
      return { 
        status: 'error', 
        message: data.errors?.[0]?.message || 'Unknown API error', 
        errors: data.errors 
      };
    }
    
    const mp4Status = data.result?.default?.status || 'unknown';
    const mp4Progress = data.result?.default?.percentComplete || 0;
    const mp4Url = data.result?.default?.url || null;
    
    console.log(`[POLL-MP4] Video ${videoUid} MP4 status: ${mp4Status}, progress: ${mp4Progress}%`);
    
    // Update MP4 status info in database
    await supabase
      .from('clips')
      .update({
        mp4_status: mp4Status,
        mp4_percent: mp4Progress,
        mp4_url: mp4Url,
        progress: Math.max(getMinProgressForStatus('waitformp4'), mp4Progress)
      })
      .eq('cloudflare_uid', videoUid);
    
    // If MP4 is ready, change status to mp4downloading
    if (mp4Status === 'ready' && mp4Url) {
      console.log(`[POLL-MP4] MP4 is ready for video ${videoUid}, changing to mp4downloading status`);
      
      await supabase
        .from('clips')
        .update({
          status: 'mp4downloading',
          status_message: getStatusMessage('mp4downloading'),
          progress: getMinProgressForStatus('mp4downloading'),
          mp4_download_url: mp4Url,
          mp4_ready_at: new Date().toISOString()
        })
        .eq('cloudflare_uid', videoUid);
      
      // Trigger upload-to-r2 endpoint
      try {
        const r2Response = await fetch('http://localhost:3000/api/cloudflare/upload-to-r2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Source': 'poll-mp4'
          },
          body: JSON.stringify({ videoUid })
        });
        
        console.log(`[POLL-MP4] R2 upload triggered, status: ${r2Response.status}`);
      } catch (r2Error) {
        console.log(`[POLL-MP4] Error triggering R2 upload: ${r2Error.message}`);
      }
      
      return { 
        status: 'ready', 
        message: 'MP4 is ready for download', 
        mp4Status, 
        mp4Progress, 
        mp4Url,
        nextStep: 'upload-to-r2'
      };
    }
    
    // If still in progress, just return the current status
    return { 
      status: 'in_progress', 
      message: `MP4 is ${mp4Status} (${mp4Progress}%)`, 
      mp4Status, 
      mp4Progress 
    };
    
  } catch (error) {
    console.error(`[POLL-MP4] Error checking MP4 status for ${videoUid}: ${error.message}`);
    
    // Update with error info
    try {
      await supabase
        .from('clips')
        .update({
          error_message: error.message
        })
        .eq('cloudflare_uid', videoUid);
    } catch (updateError) {
      console.error(`[POLL-MP4] Error updating error message: ${updateError.message}`);
    }
    
    return { status: 'error', message: error.message };
  }
} 