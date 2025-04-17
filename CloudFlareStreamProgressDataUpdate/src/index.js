import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Get the current status of a video from Cloudflare
 * @param {string} uid - Cloudflare video UID
 * @returns {Promise<Object>} Video data from Cloudflare
 */
async function getCloudflareStatus(uid) {
  console.log(`[Cloudflare] Checking status for video: ${uid}`);
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`[Cloudflare] Error fetching status: ${response.statusText}`);
      throw new Error(`Failed to fetch video status: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Cloudflare] Status for ${uid}: ${data.result.status.state}`);
    return data.result;
  } catch (error) {
    console.error(`[Cloudflare] Error checking status: ${error.message}`);
    throw error;
  }
}

/**
 * Map Cloudflare status to our application status
 * @param {string} cfStatus - Cloudflare status
 * @returns {string} Application status
 */
function mapCloudflareStatus(cfStatus) {
  switch (cfStatus) {
    case 'pendingupload': return 'uploading';
    case 'queued': return 'queue';
    case 'inprogress': return 'processing';
    case 'ready': return 'ready_to_stream';
    default: return 'unknown';
  }
}

/**
 * Monitor videos in uploading, queue, and processing status and update their status
 */
async function monitorPendingVideos() {
  console.log('\n[Monitor] ================== STARTING VIDEO CHECK ==================');
  
  try {
    // Step 1: Find videos in uploading, queue, or processing status
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .in('status', ['uploading', 'queue', 'processing'])
      .order('uploaded_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('[Monitor] ❌ Database error:', error.message);
      throw error;
    }

    if (!data?.length) {
      console.log('[Monitor] ✓ No videos found requiring processing');
      console.log('[Monitor] ================== CHECK COMPLETE ==================\n');
      return;
    }

    console.log(`[Monitor] 🔍 Found ${data.length} video(s) to check`);

    for (const video of data) {
      const cloudflareUid = video.cloudflare_uid;
      if (!cloudflareUid) {
        console.log('[Monitor] ⚠️ Skipping video: No cloudflare_uid');
        continue;
      }
      
      console.log(`[Monitor] 🎬 Processing video: ${cloudflareUid}`);

      try {
        // Step 2: Get Cloudflare status
        const cloudflareData = await getCloudflareStatus(cloudflareUid);
        const cfStatus = cloudflareData.status.state || 'unknown';
        
        // Step 3: Map Cloudflare status to our status
        const newStatus = mapCloudflareStatus(cfStatus);
        console.log(`[Monitor] 🔄 Status mapping: ${cfStatus} -> ${newStatus}`);
        
        // Step 4: Update status if changed
        if (newStatus !== video.status && newStatus !== 'unknown') {
          console.log(`[Monitor] ⚠️ Updating status from ${video.status} to ${newStatus}`);
          await supabase
            .from('clips')
            .update({ status: newStatus })
            .eq('cloudflare_uid', cloudflareUid);
          
          // Step 5: If video is ready, trigger MP4 enable
          if (newStatus === 'ready_to_stream') {
            console.log(`[Monitor] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
            console.log(`[Monitor] 🚀 Video ${cloudflareUid} is READY TO STREAM - Triggering MP4 enable`);
            
            try {
              const response = await fetch('http://localhost:3000/api/cloudflare/enable-mp4', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Source': 'cloudflare-monitor'
                },
                body: JSON.stringify({ videoUid: cloudflareUid }),
              });
              
              console.log(`[Monitor] ✅ MP4 enable SUCCESSFULLY triggered for ${cloudflareUid}`);
              console.log(`[Monitor] 📊 Response status: ${response.status}`);
              console.log(`[Monitor] ℹ️ MP4 processing will continue in enable-mp4.js`);

              // Start status polling to track completion
              console.log(`[Monitor] 🔍 Starting status polling to track full completion`);
              
              // Set up a polling mechanism to check video status
              const pollVideoStatus = async () => {
                try {
                  // Check status in the database
                  const { data } = await supabase
                    .from('clips')
                    .select('status, mp4link')
                    .eq('cloudflare_uid', cloudflareUid)
                    .single();
                  
                  if (data) {
                    console.log(`[Monitor] 📊 Current video status: ${data.status}`);
                    
                    if (data.status === 'complete') {
                      console.log(`[Monitor] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
                      console.log(`[Monitor] 🎉 FULL PROCESS COMPLETED SUCCESSFULLY for ${cloudflareUid}`);
                      console.log(`[Monitor] 🎬 Video is now ready to be played!`);
                      console.log(`[Monitor] 🔗 MP4 URL: ${data.mp4link}`);
                      console.log(`[Monitor] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
                      return true; // Polling can stop
                    } else if (data.status === 'error') {
                      console.log(`[Monitor] ❌ Process failed with error status`);
                      return true; // Polling can stop
                    }
                  }
                  return false; // Continue polling
                } catch (error) {
                  console.error(`[Monitor] ❌ Error polling video status: ${error.message}`);
                  return true; // Stop polling on error
                }
              };
              
              // Poll every 5 seconds for up to 5 minutes
              let pollAttempts = 0;
              const maxPollAttempts = 60; // 5 minutes (5 seconds * 60)
              
              const pollInterval = setInterval(async () => {
                pollAttempts++;
                
                if (pollAttempts > maxPollAttempts) {
                  console.log(`[Monitor] ⏱️ Status polling timed out after ${maxPollAttempts} attempts`);
                  clearInterval(pollInterval);
                  return;
                }
                
                const shouldStop = await pollVideoStatus();
                if (shouldStop) {
                  clearInterval(pollInterval);
                }
              }, 5000);

              console.log(`[Monitor] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
            } catch (error) {
              console.log(`[Monitor] ❌ FAILED to trigger MP4 enable for ${cloudflareUid}: ${error.message}`);
            }
          }
        } else {
          console.log(`[Monitor] ✓ Status unchanged: ${video.status}`);
        }
      } catch (error) {
        console.error(`[Monitor] ❌ Error processing video ${cloudflareUid}:`, error.message);
        await supabase
          .from('clips')
          .update({
            status: 'error',
            error_message: error.message
          })
          .eq('cloudflare_uid', cloudflareUid);
      }
    }
  } catch (error) {
    console.error('[Monitor] ❌ Critical error:', error.message);
  }
  
  console.log('[Monitor] ================== CHECK COMPLETE ==================\n');
}

// Start monitoring
console.log('[Service] Starting video monitoring service...');
console.log('[Service] Checking videos every 10 seconds');

// Check every 10 seconds
setInterval(monitorPendingVideos, 10 * 1000);

// Do an initial check immediately
monitorPendingVideos();
