import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import fetch from 'node-fetch';
import { 
  STATUS_ORDER, 
  CLOUDFLARE_STATUS_MAPPING,
  getStatusMessage,
  getMinProgressForStatus,
  isValidStatusTransition
} from './statusUtils.js';

// ============= CONFIGURATIONS =============
// Define key settings for video processing 
const CONFIG = {
  TIMEOUTS: {
    PENDING_UPLOAD: 5, // minutes before canceling pending uploads
    CHECK_INTERVAL: 10, // seconds between checking video status
  }
};

// Initialize logger for tracking operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Initialize Supabase client for database operations
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cloudflare API credentials
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// ============= STATE TRACKING =============
// Track videos in different states
const completedVideos = new Set(); // Videos that have finished processing
const processingVideos = new Set(); // Videos currently being processed

// Constants for time calculations
const MS_PER_MINUTE = 60 * 1000;

// ============= CORE FUNCTIONS =============

/**
 * Get the current status of a video from Cloudflare
 * 
 * @param {string} uid - Cloudflare video UID
 * @returns {object} Cloudflare video data
 */
async function getCloudflareStatus(uid) {
  try {
    // Call Cloudflare API to get video status
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Handle video not found in Cloudflare
    if (response.status === 404) {
      logger.warn(`Video ${uid} not found in Cloudflare`);
      
      // Update database with error status
      await supabase
        .from('clips')
        .update({
          status: 'error',
          error_message: 'Video not found in Cloudflare'
        })
        .eq('cloudflare_uid', uid);
      
      completedVideos.add(uid);
      throw new Error('VIDEO_NOT_FOUND');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch video status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    logger.error(`Error fetching Cloudflare status for ${uid}:`, error);
    throw error;
  }
}

/**
 * Delete a video from Cloudflare and database
 * 
 * @param {string} uid - Cloudflare video UID
 * @returns {boolean} Success status
 */
async function deleteCloudflareVideo(uid) {
  try {
    logger.info(`[VIDEO ${uid}] Deleting video from Cloudflare...`);
    
    // Delete from Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Update database
    await supabase
      .from('clips')
      .update({
        status: 'error',
        error_message: 'Video deleted from Cloudflare'
      })
      .eq('cloudflare_uid', uid);
      
    logger.info(`[VIDEO ${uid}] Successfully deleted video`);
    return true;
  } catch (error) {
    logger.error(`[VIDEO ${uid}] Error deleting video:`, error);
    throw error;
  }
}

/**
 * Update the database with the latest video status from Cloudflare
 * 
 * @param {string} uid - Cloudflare video UID
 * @param {object} cloudflareData - Data from Cloudflare API
 * @returns {boolean} Whether the video has reached a final state
 */
async function updateDatabaseStatus(uid, cloudflareData) {
  try {
    logger.info(`[VIDEO ${uid}] --- START STATUS UPDATE ---`);
    const cfStatus = cloudflareData.status.state || 'unknown';
    
    // Check current status first
    const { data: currentData, error: checkError } = await supabase
      .from('clips')
      .select('status, uploaded_at, progress')
      .eq('cloudflare_uid', uid)
      .single();

    if (checkError) {
      logger.error(`[VIDEO ${uid}] ERROR: Cannot fetch clip data: ${checkError.message}`);
      throw checkError;
    }

    const currentStatus = currentData.status || '';
    const currentProgress = currentData.progress || 0;
    const progressValue = cloudflareData.status.pctComplete || 0;
    
    logger.info(`[VIDEO ${uid}] CURRENT STATUS: ${currentStatus}, PROGRESS: ${currentProgress}%`);
    logger.info(`[VIDEO ${uid}] CLOUDFLARE STATUS: ${cfStatus}, PROGRESS: ${progressValue}%`);

    // Check for pending timeout
    if (cfStatus === 'pendingupload') {
      const startTime = new Date(currentData.uploaded_at);
      const now = new Date();
      const minutesElapsed = (now - startTime) / MS_PER_MINUTE;

      if (minutesElapsed > CONFIG.TIMEOUTS.PENDING_UPLOAD) {
        logger.warn(`[VIDEO ${uid}] TIMEOUT: Stuck in pendingupload for ${Math.round(minutesElapsed)} minutes, deleting video`);
        await deleteCloudflareVideo(uid);
        completedVideos.add(uid);
        return true;
      }
      
      // Just update progress if still uploading
      await supabase
        .from('clips')
        .update({
          progress: Math.max(currentProgress, progressValue, 15)
        })
        .eq('cloudflare_uid', uid);
      
      return false;
    }
    
    // Simple status mapping from Cloudflare status
    let newStatus = currentStatus;
    let updateNeeded = false;
    
    // Clear sequential status progression
    if (cfStatus === 'queued' && currentStatus === 'uploading') {
      newStatus = 'queued';
      updateNeeded = true;
    } 
    else if (cfStatus === 'inprogress' && (currentStatus === 'uploading' || currentStatus === 'queued')) {
      newStatus = 'processing';
      updateNeeded = true;
    }
    else if (cfStatus === 'ready' && currentStatus !== 'stream_ready' && 
             !['waitformp4', 'mp4_processing', 'mp4downloading', 'r2_uploading', 'complete'].includes(currentStatus)) {
      newStatus = 'stream_ready';
      updateNeeded = true;
    }
    else if (cfStatus === 'error') {
      newStatus = 'error';
      updateNeeded = true;
    }
    
    // Skip if no status change needed
    if (!updateNeeded && currentProgress === progressValue) {
      logger.info(`[VIDEO ${uid}] NO CHANGE: Skipping database update`);
      return currentStatus === 'complete' || currentStatus === 'error';
    }
    
    // Update basic video metadata
    const updatePayload = {
      status: newStatus,
      progress: Math.max(currentProgress, progressValue, getMinProgressForStatus(newStatus)),
      status_message: getStatusMessage(newStatus)
    };
    
    // Add additional fields if they exist in Cloudflare response
    if (cloudflareData.duration !== undefined && cloudflareData.duration !== null) {
      updatePayload.duration = cloudflareData.duration;
    }
    
    if (cloudflareData.size !== undefined && cloudflareData.size !== null) {
      updatePayload.file_size = cloudflareData.size;
    }
    
    if (cloudflareData.thumbnail) {
      updatePayload.thumbnail_url = cloudflareData.thumbnail;
      updatePayload.thumbnail_path = cloudflareData.thumbnail;
    }
    
    if (cloudflareData.playback?.hls) {
      updatePayload.hls_url = cloudflareData.playback.hls;
    }
    
    if (cloudflareData.playback?.dash) {
      updatePayload.dash_url = cloudflareData.playback.dash;
    }

    if (cloudflareData.status.errorReasonText) {
      updatePayload.error_message = cloudflareData.status.errorReasonText;
    }

    logger.info(`[VIDEO ${uid}] UPDATING DATABASE: Setting status to ${newStatus}`);
    const { error: updateError } = await supabase
      .from('clips')
      .update(updatePayload)
      .eq('cloudflare_uid', uid);

    if (updateError) {
      logger.error(`[VIDEO ${uid}] DATABASE ERROR: ${updateError.message}`);
      throw updateError;
    }
    
    // When reaching stream_ready, call the enable-mp4 API
    if (newStatus === 'stream_ready') {
      logger.info(`[VIDEO ${uid}] Video is READY. Calling enable-mp4 API...`);
      
      try {
        // Call the enable-mp4 API and then stop tracking this video
        const response = await fetch('http://localhost:3000/api/cloudflare/enable-mp4', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Source': 'cloudflare-monitor'
          },
          body: JSON.stringify({ videoUid: uid }),
        });
        
        if (response.ok) {
          logger.info(`[VIDEO ${uid}] Successfully handed off to enable-mp4 API`);
          completedVideos.add(uid); // Mark as completed from index.js perspective
        } else {
          logger.warn(`[VIDEO ${uid}] Failed to hand off to enable-mp4 API: ${response.status}`);
        }
      } catch (apiError) {
        logger.error(`[VIDEO ${uid}] Error calling enable-mp4 API: ${apiError.message}`);
      }
    }

    logger.info(`[VIDEO ${uid}] DATABASE UPDATED: Status=${newStatus}, Progress=${progressValue}%, Final=${newStatus === 'complete' || newStatus === 'error'}`);
    logger.info(`[VIDEO ${uid}] --- END STATUS UPDATE ---`);
    
    // Only 'complete' and 'error' are final states
    return newStatus === 'complete' || newStatus === 'error';
  } catch (error) {
    logger.error(`[VIDEO ${uid}] CRITICAL ERROR: ${error.message}`);
    throw error;
  }
}

/**
 * Monitor both regular videos and those with requested status changes
 */
async function monitorPendingVideos() {
  try {
    // First part: Check videos in early processing stages (original behavior)
    logger.info(`[MONITOR] === START CHECKING VIDEOS ===`);
    
    // Only monitor videos in early states (before MP4 processing begins)
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .in('status', ['uploading', 'queued', 'processing']) 
      .order('uploaded_at', { ascending: true });

    if (error) {
      logger.error(`[MONITOR] ERROR: Cannot fetch videos: ${error.message}`);
      throw error;
    }

    if (data?.length) {
      logger.info(`[MONITOR] Found ${data.length} videos to check`);

      // Process each pending video
      for (const video of data) {
        try {
          const cloudflareUid = video.cloudflare_uid;
          if (!cloudflareUid) {
            logger.warn(`[MONITOR] Skipping video ${video.id}: No cloudflare_uid`);
            continue;
          }
          
          logger.info(`[VIDEO ${cloudflareUid}] Checking: "${video.title || 'Untitled'}" (Status: ${video.status})`);
          
          // Skip if already being processed to avoid duplicates
          if (processingVideos.has(cloudflareUid)) {
            logger.info(`[VIDEO ${cloudflareUid}] Skipping: Already being processed`);
            continue;
          }

          // Mark as processing
          processingVideos.add(cloudflareUid);
          
          // Check video age
          const minutesElapsed = Math.round((new Date() - new Date(video.uploaded_at)) / MS_PER_MINUTE);
          logger.info(`[VIDEO ${cloudflareUid}] Age: ${minutesElapsed} minutes`);

          // Get current status from Cloudflare
          logger.info(`[VIDEO ${cloudflareUid}] Checking Cloudflare status...`);
          const cloudflareData = await getCloudflareStatus(cloudflareUid);
          logger.info(`[VIDEO ${cloudflareUid}] Cloudflare reports: ${cloudflareData.status.state} (${cloudflareData.status.pctComplete || 0}%)`);
          
          // Continue with normal processing
          const isComplete = await updateDatabaseStatus(cloudflareUid, cloudflareData);

          if (isComplete) {
            logger.info(`[VIDEO ${cloudflareUid}] COMPLETED: Processing finished`);
            completedVideos.add(cloudflareUid);
          } else {
            logger.info(`[VIDEO ${cloudflareUid}] Still processing: ${cloudflareData.status.state}`);
          }

          // Remove from processing set
          processingVideos.delete(cloudflareUid);
        } catch (error) {
          logger.error(`[VIDEO ${video.cloudflare_uid}] ERROR: ${error.message}`);
          processingVideos.delete(video.cloudflare_uid);
          await handleVideoError(video, error);
        }
      }
    } else {
      logger.info(`[MONITOR] No videos to check`);
    }

    // Second part: Check for videos with requested status changes
    logger.info(`[MONITOR] Checking for videos with requested status updates...`);
    
    // Query for videos with requested status changes
    const { data: videosWithRequestedStatus, error: requestedStatusError } = await supabase
      .from('clips')
      .select('*')
      .not('requested_status', 'is', null)
      .order('uploaded_at', { ascending: true })
      .limit(10);
    
    if (requestedStatusError) {
      logger.error(`[MONITOR] Error fetching videos with requested status: ${requestedStatusError.message}`);
      return;
    }
    
    if (videosWithRequestedStatus && videosWithRequestedStatus.length > 0) {
      logger.info(`[MONITOR] Found ${videosWithRequestedStatus.length} videos with requested status changes`);
      
      for (const video of videosWithRequestedStatus) {
        const videoUid = video.cloudflare_uid;
        const currentStatus = video.status || 'unknown';
        const requestedStatus = video.requested_status;
        
        logger.info(`[MONITOR] Processing requested status change for ${videoUid}: ${currentStatus} -> ${requestedStatus}`);
        
        // Check if the requested status is different from current
        if (currentStatus === requestedStatus) {
          logger.info(`[MONITOR] Requested status is same as current (${currentStatus}), clearing request`);
          
          // Clear the requested status
          await supabase
            .from('clips')
            .update({ 
              requested_status: null,
              requested_status_at: null
            })
            .eq('cloudflare_uid', videoUid);
            
          continue;
        }
        
        // Handle specific status transitions
        if (requestedStatus === 'waitformp4') {
          logger.info(`[MONITOR] Processing waitformp4 request for ${videoUid}`);
          
          // Check MP4 status first
          try {
            const mp4Status = await checkMp4Status(videoUid);
            logger.info(`[MONITOR] MP4 status for ${videoUid}: ${mp4Status.status}`);
            
            if (mp4Status.status === 'ready' && mp4Status.url) {
              // MP4 is ready, go directly to mp4downloading
              await updateVideoStatus(
                videoUid, 
                'mp4downloading', 
                getStatusMessage('mp4downloading'),
                getMinProgressForStatus('mp4downloading'),
                {
                  mp4_status: mp4Status.status,
                  mp4_percent: 100,
                  mp4_url: mp4Status.url,
                  mp4_download_url: mp4Status.url,
                  mp4_ready_at: new Date().toISOString(),
                  requested_status: null,
                  requested_status_at: null
                }
              );
              
              logger.info(`[MONITOR] Updated status to mp4downloading for ${videoUid}, will trigger R2 upload`);
              
              // Trigger the upload-to-r2 endpoint
              try {
                const r2Response = await fetch('http://localhost:3000/api/cloudflare/upload-to-r2', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Source': 'monitor-pending'
                  },
                  body: JSON.stringify({ videoUid })
                });
                
                logger.info(`[MONITOR] R2 upload triggered, status: ${r2Response.status}`);
              } catch (r2Error) {
                logger.error(`[MONITOR] Error triggering R2 upload: ${r2Error.message}`);
              }
            } else {
              // MP4 is still processing, update to waitformp4
              await updateVideoStatus(
                videoUid, 
                'waitformp4', 
                getStatusMessage('waitformp4'),
                getMinProgressForStatus('waitformp4'),
                {
                  mp4_status: mp4Status.status,
                  mp4_percent: mp4Status.progress || 0,
                  mp4_url: mp4Status.url || null,
                  requested_status: null,
                  requested_status_at: null
                }
              );
              
              logger.info(`[MONITOR] Updated status to waitformp4 for ${videoUid}, MP4 is being processed`);
            }
          } catch (mp4Error) {
            logger.error(`[MONITOR] Error checking MP4 status for ${videoUid}: ${mp4Error.message}`);
            
            // Update with error but keep in wait state
            await updateVideoStatus(
              videoUid, 
              'waitformp4', 
              `Error checking MP4: ${mp4Error.message}`,
              getMinProgressForStatus('waitformp4'),
              {
                requested_status: null,
                requested_status_at: null
              }
            );
          }
        } else if (requestedStatus === 'error') {
          // Special handling for error status
          logger.info(`[MONITOR] Processing error status request for ${videoUid}`);
          
          const errorMessage = video.error_message || 'Unknown error';
          
          await updateVideoStatus(
            videoUid, 
            'error', 
            errorMessage,
            getMinProgressForStatus('error'),
            {
              requested_status: null,
              requested_status_at: null
            }
          );
          
          logger.info(`[MONITOR] Updated status to error for ${videoUid}: ${errorMessage}`);
        } else {
          // Check if the requested status is valid according to progression
          if (isValidStatusTransition(currentStatus, requestedStatus)) {
            logger.info(`[MONITOR] Valid status transition: ${currentStatus} -> ${requestedStatus}`);
            
            // Update to the requested status
            await updateVideoStatus(
              videoUid, 
              requestedStatus, 
              getStatusMessage(requestedStatus),
              getMinProgressForStatus(requestedStatus),
              {
                requested_status: null,
                requested_status_at: null
              }
            );
            
            logger.info(`[MONITOR] Updated status to ${requestedStatus} for ${videoUid}`);
          } else {
            logger.info(`[MONITOR] Invalid status transition: ${currentStatus} -> ${requestedStatus}, ignoring`);
            
            // Clear the requested status
            await supabase
              .from('clips')
              .update({ 
                requested_status: null,
                requested_status_at: null
              })
              .eq('cloudflare_uid', videoUid);
          }
        }
      }
    } else {
      logger.info(`[MONITOR] No videos with requested status changes found`);
    }

    logger.info(`[MONITOR] === FINISHED CHECKING VIDEOS ===`);
  } catch (error) {
    logger.error(`[MONITOR] CRITICAL ERROR: ${error.message}`);
  }
}

/**
 * Handle errors for a video
 * 
 * @param {object} video - Video data from database
 * @param {Error} error - Error object
 */
async function handleVideoError(video, error) {
  const cloudflareUid = video.cloudflare_uid;
  if (!cloudflareUid) {
    logger.warn(`Cannot handle error for video without cloudflare_uid`);
    return;
  }

  // Update database with error information
  const errorUpdate = {
    status: 'error',
    error_message: error.message,
    error_type: error.message === 'VIDEO_NOT_FOUND' ? 'not_found_in_cloudflare' : 'processing_error'
  };

  await supabase
    .from('clips')
    .update(errorUpdate)
    .eq('cloudflare_uid', cloudflareUid);
}

/**
 * Initialize the monitoring system
 * Sets up periodic checks of video status
 */
async function initializeMonitoring() {
  try {
    logger.info('Initializing video monitoring...');
    
    // Set up regular checks for pending videos
    setInterval(async () => {
      try {
        await monitorPendingVideos();
      } catch (error) {
        logger.error('Pending videos check failed:', error);
      }
    }, CONFIG.TIMEOUTS.CHECK_INTERVAL * 1000);

    // Set up regular checks for MP4 status
    setInterval(async () => {
      try {
        logger.info('Polling MP4 status for videos in waitformp4 status...');
        const response = await fetch('http://localhost:3000/api/cloudflare/poll-mp4-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Source': 'cloudflare-monitor'
          },
          body: JSON.stringify({}), // Empty body will check all videos in waitformp4 status
        });
        
        if (response.ok) {
          const data = await response.json();
          logger.info(`MP4 polling completed: ${data.message}`);
        } else {
          logger.warn(`Failed to poll MP4 status: ${response.status}`);
        }
      } catch (error) {
        logger.error('MP4 polling failed:', error);
      }
    }, 15 * 1000); // Check every 15 seconds

    // Do an initial check immediately
    await monitorPendingVideos();
    
    logger.info('Video monitoring initialized');
  } catch (error) {
    logger.error('Error initializing monitoring:', error);
    throw error;
  }
}

// Start the service
initializeMonitoring().catch(error => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  process.exit(0);
});

/**
 * Update a video status with all related fields
 * 
 * @param {string} videoUid - Cloudflare video UID
 * @param {string} status - New status to set
 * @param {string} statusMessage - Status message to display
 * @param {number} progress - Progress percentage
 * @param {object} additionalFields - Any additional fields to update
 * @returns {Promise<boolean>} Success status
 */
async function updateVideoStatus(videoUid, status, statusMessage, progress, additionalFields = {}) {
  try {
    // Create the update payload with direct fields
    const updatePayload = {
      status,
      status_message: statusMessage,
      progress,
      ...additionalFields,
      last_updated: new Date().toISOString()
    };
    
    console.log(`[STATUS] Updating ${videoUid} to ${status} with progress ${progress}%`);
    
    // Update the database
    const { error } = await supabase
      .from('clips')
      .update(updatePayload)
      .eq('cloudflare_uid', videoUid);
      
    if (error) {
      console.error(`[STATUS] Error updating status: ${error.message}`);
      return false;
    }
    
    console.log(`[STATUS] Successfully updated ${videoUid} to ${status}`);
    return true;
  } catch (error) {
    console.error(`[STATUS] Exception updating status: ${error.message}`);
    return false;
  }
}

/**
 * Check MP4 status from Cloudflare
 * 
 * @param {string} videoUid - Cloudflare video UID
 * @returns {Promise<object>} MP4 status information
 */
async function checkMp4Status(videoUid) {
  try {
    console.log(`[MP4-Check] Checking MP4 status for ${videoUid}`);
    
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
      throw new Error(`Cloudflare API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Cloudflare API returned an error');
    }
    
    const mp4Data = data.result?.default || {};
    
    return {
      status: mp4Data.status || 'unknown',
      progress: mp4Data.percentComplete || 0,
      url: mp4Data.url || null
    };
  } catch (error) {
    console.error(`[MP4-Check] Error: ${error.message}`);
    throw error;
  }
} 

