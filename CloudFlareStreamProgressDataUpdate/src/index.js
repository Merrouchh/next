import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import fetch from 'node-fetch';

// ============= CONFIGURATIONS =============
// Define key settings for video processing 
const CONFIG = {
  TIMEOUTS: {
    PENDING_UPLOAD: 5, // minutes before canceling pending uploads
    CHECK_INTERVAL: 10, // seconds between checking video status
  },
  // Map from Cloudflare states to our internal states
  STATUS_MAPPING: {
    pendingupload: 'uploading',   // Initial upload to Cloudflare
    inprogress: 'processing',     // Cloudflare processing the video
    ready: 'ready',               // Basic Cloudflare processing complete
    error: 'error',               // Processing error
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
      
      // Use the delete-video API to clean up database as well
      try {
        logger.info(`[VIDEO ${uid}] Not found in Cloudflare, cleaning up via delete-video API`);
        await deleteCloudflareVideo(uid);
      } catch (deleteError) {
        logger.error(`[VIDEO ${uid}] Failed to clean up via delete-video API: ${deleteError.message}`);
        // Fall back to direct database update if delete API fails
      await supabase
          .from('clips')
        .update({
            status: 'error',
            processing_details: {
              error_type: 'not_found_in_cloudflare',
          error_message: 'Video not found in Cloudflare',
            checked_at: new Date().toISOString()
            }
        })
        .eq('cloudflare_uid', uid);
      }
      
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
 * Delete a video from Cloudflare and database using the delete-video API
 * This function makes a request to the delete-video API endpoint instead
 * of directly interacting with Cloudflare and the database. This ensures
 * consistent deletion behavior across the application.
 * 
 * @param {string} uid - Cloudflare video UID
 * @returns {boolean} Success status
 */
async function deleteCloudflareVideo(uid) {
  try {
    logger.info(`[VIDEO ${uid}] Calling delete-video API to remove video...`);
    
    // Use the delete-video API endpoint instead of direct deletion
    const response = await fetch('http://localhost:3000/api/cloudflare/delete-video', {
      method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Source': 'cloudflare-monitor'
      },
      body: JSON.stringify({ videoUid: uid }),
    });
    
    const data = await response.json().catch(() => ({}));
    
    if (response.ok) {
      logger.info(`[VIDEO ${uid}] Successfully deleted via delete-video API`);
      return true;
    } else {
      logger.error(`[VIDEO ${uid}] Failed to delete via API: ${data.message || response.statusText}`);
      throw new Error(`API deletion failed: ${data.message || response.statusText}`);
    }
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
    const dbStatus = CONFIG.STATUS_MAPPING[cloudflareData.status.state] || cloudflareData.status.state;
    
    // Check current status first
    const { data: currentData, error: checkError } = await supabase
      .from('clips')
      .select('status, processing_details, uploaded_at')
      .eq('cloudflare_uid', uid)
      .single();

    if (checkError) {
      logger.error(`[VIDEO ${uid}] ERROR: Cannot fetch clip data: ${checkError.message}`);
      throw checkError;
    }

    const processingDetails = currentData.processing_details || {};
    
    logger.info(`[VIDEO ${uid}] CURRENT STATUS: ${currentData.status}, PROGRESS: ${processingDetails.progress || 0}%`);
    logger.info(`[VIDEO ${uid}] CLOUDFLARE STATUS: ${cloudflareData.status.state} → ${dbStatus}, PROGRESS: ${cloudflareData.status.pctComplete || 0}%`);

    // Check for pending timeout
    if (cloudflareData.status.state === 'pendingupload') {
      const startTime = new Date(currentData.uploaded_at);
      const now = new Date();
      const minutesElapsed = (now - startTime) / MS_PER_MINUTE;

      if (minutesElapsed > CONFIG.TIMEOUTS.PENDING_UPLOAD) {
        logger.warn(`[VIDEO ${uid}] TIMEOUT: Stuck in pendingupload for ${Math.round(minutesElapsed)} minutes, deleting video`);
        // Use the delete-video API endpoint for consistent deletion
        await deleteCloudflareVideo(uid);
        completedVideos.add(uid);
        return true;
      }
    }

    // Update processing_details with current Cloudflare status
    const updatedDetails = {
      ...processingDetails,
      cloudflare_status: cloudflareData.status.state,
      processing_step: cloudflareData.status.step,
      error_code: cloudflareData.status.errorReasonCode,
      last_checked: new Date().toISOString(),
      processing_complete: ['ready', 'error', 'cancelled'].includes(cloudflareData.status.state),
      progress: cloudflareData.status.pctComplete || 0
    };

    // Skip if status and progress haven't changed and not in pending state
    if (currentData.status === getMappedProcessingStatus(dbStatus, updatedDetails) && 
        processingDetails.progress === cloudflareData.status.pctComplete &&
        dbStatus !== 'pendingupload') {
      logger.info(`[VIDEO ${uid}] NO CHANGE: Skipping database update`);
      // Check if this is really a final state - only complete and error states are truly final
      const currentStatus = currentData.status;
      const isReallyFinal = currentStatus === 'complete' || currentStatus === 'error';
      return isReallyFinal;
    }

    // Map Cloudflare status to processing_status for the clips table
    const clipProcessingStatus = getMappedProcessingStatus(dbStatus, updatedDetails);
    
    // Update basic video metadata if available
    const updatePayload = {
      status: clipProcessingStatus,
      processing_details: updatedDetails
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
      updatePayload.processing_details.thumbnail_url = cloudflareData.thumbnail;
      updatePayload.thumbnail_path = cloudflareData.thumbnail;
    }
    
    if (cloudflareData.playback?.hls) {
      updatePayload.hls_url = cloudflareData.playback.hls;
      updatePayload.processing_details.hls_url = cloudflareData.playback.hls;
    }
    
    if (cloudflareData.playback?.dash) {
      updatePayload.dash_url = cloudflareData.playback.dash;
      updatePayload.processing_details.dash_url = cloudflareData.playback.dash;
    }

    if (cloudflareData.status.errorReasonText) {
      // Store error in processing_details and error_message field
      updatePayload.processing_details.error_message = cloudflareData.status.errorReasonText;
      updatePayload.processing_details.error_time = new Date().toISOString();
      updatePayload.error_message = cloudflareData.status.errorReasonText;
    }

    logger.info(`[VIDEO ${uid}] UPDATING DATABASE: Setting status to ${clipProcessingStatus}`);
    const { error: updateError } = await supabase
      .from('clips')
      .update(updatePayload)
      .eq('cloudflare_uid', uid);

    if (updateError) {
      logger.error(`[VIDEO ${uid}] DATABASE ERROR: ${updateError.message}`);
      throw updateError;
    }
    
    // Check if this is really a final state - only complete and error states are truly final
    const statusIsFinal = clipProcessingStatus === 'complete' || clipProcessingStatus === 'error';
    
    logger.info(`[VIDEO ${uid}] DATABASE UPDATED: Status=${clipProcessingStatus}, Progress=${cloudflareData.status.pctComplete || 0}%, Final=${statusIsFinal}`);

    // Special handling for 'ready' state - this is our handoff point
    if (cloudflareData.status.state === 'ready') {
      // First check if this video has already started MP4 processing
      const { data: currentState } = await supabase
        .from('clips')
        .select('status, processing_details')
        .eq('cloudflare_uid', uid)
        .single();
      
      // Check ALL possible MP4 and R2 related statuses to avoid any cycling
      const inMp4Process = currentState && [
        'mp4_processing', 
        'waitformp4', 
        'mp4downloading', 
        'r2_uploading'
      ].includes(currentState.status);
      
      // Also check if MP4 processing has started in any way
      const mp4Started = currentState?.processing_details?.mp4_processing_started ||
                        currentState?.processing_details?.mp4_poll_started ||
                        currentState?.processing_details?.mp4_status === 'polling';
      
      // Log thorough status information
      logger.info(`[VIDEO ${uid}] Current status: ${currentState?.status}, MP4 process started: ${mp4Started ? 'YES' : 'NO'}`);
      
      if (inMp4Process || mp4Started) {
        logger.info(`[VIDEO ${uid}] Already in MP4 processing flow: ${currentState?.status}. Skipping duplicate enable-mp4 call to prevent status cycling.`);
        completedVideos.add(uid); // Mark as completed from index.js perspective
        processingVideos.delete(uid);
        return false; // Return false to indicate this video doesn't need further processing
      }
      
      // Mark as stream_ready but also add flag to prevent reprocessing
      logger.info(`[VIDEO ${uid}] Setting handoff_to_mp4_processing flag to prevent future enable-mp4 calls`);
      await supabase
        .from('clips')
        .update({
          status: 'stream_ready',
          processing_details: {
            ...(currentData.processing_details || {}),
            cloudflare_status: 'ready',
            progress: cloudflareData.status.pctComplete || 0,
            last_checked: new Date().toISOString(),
            handoff_to_mp4_processing: true, // This flag signals that index.js has done its job
            handoff_time: new Date().toISOString() // Record when handoff occurred for debugging
          }
        })
        .eq('cloudflare_uid', uid);
        
      logger.info(`[VIDEO ${uid}] Video is READY. Handing off to enable-mp4 API...`);
      
      try {
        // Check if we've already attempted a handoff before calling the API
        if (currentData.processing_details?.handoff_to_mp4_processing) {
          logger.info(`[VIDEO ${uid}] Handoff flag already set, skipping duplicate enable-mp4 API call`);
          completedVideos.add(uid); // Mark as completed from index.js perspective
          return false;
        }
        
        // Call the enable-mp4 API and then stop tracking this video
        const response = await fetch('http://localhost:3000/api/cloudflare/enable-mp4', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Source': 'cloudflare-monitor' // Add source header to identify where call is coming from
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

    logger.info(`[VIDEO ${uid}] --- END STATUS UPDATE ---`);
    
    // Only consider 'complete' and 'error' as truly final states
    return statusIsFinal;
  } catch (error) {
    logger.error(`[VIDEO ${uid}] CRITICAL ERROR: ${error.message}`);
    throw error;
  }
}

/**
 * Map Cloudflare status to our internal processing status
 * 
 * @param {string} dbStatus - Raw status from Cloudflare
 * @param {object} metadata - Processing metadata
 * @returns {string} Mapped processing status 
 */
function getMappedProcessingStatus(dbStatus, metadata) {
  // MP4 processing statuses - don't change these once set
  if (['waitformp4', 'mp4downloading', 'mp4_processing', 'r2_uploading'].includes(dbStatus)) {
    return dbStatus; // Keep as-is to prevent cycling
  }
  
  switch (dbStatus) {
    // Initial upload statuses
    case 'pendingupload':
      return 'uploading';
    case 'uploading':
      return 'uploading';
    case 'queued':
      return 'queued';
    
    // Cloudflare processing statuses
    case 'processing': 
    case 'inprogress':
      return 'processing';
    
    // Ready status - simplify to always return stream_ready
    // enable-mp4.js will handle the subsequent states
    case 'ready':
      return 'stream_ready';
    
    // Error status
    case 'error':
      return 'error';
    
    // Default to uploading for unknown statuses
    default:
      return 'uploading';
  }
}

/**
 * Monitor videos that are currently in a pending state
 * This is the main function that periodically checks video status
 */
async function monitorPendingVideos() {
  try {
    logger.info(`[MONITOR] === START CHECKING VIDEOS ===`);
    
    // First check for videos in mp4downloading status that need to move to R2 upload
    const { data: mp4ReadyVideos, error: mp4Error } = await supabase
      .from('clips')
      .select('*')
      .eq('status', 'mp4downloading')
      .is('processing_details->r2_upload_started', null) // Only videos not yet started R2 upload
      .order('uploaded_at', { ascending: true })
      .limit(5); // Process a few at a time
      
    if (mp4Error) {
      logger.error(`[MONITOR] ERROR: Cannot fetch mp4downloading videos: ${mp4Error.message}`);
    } else if (mp4ReadyVideos?.length) {
      logger.info(`[MONITOR] Found ${mp4ReadyVideos.length} videos ready for R2 upload`);
      
      // Process each video ready for R2 upload
      for (const video of mp4ReadyVideos) {
        const videoUid = video.cloudflare_uid;
        if (!videoUid) continue;
        
        logger.info(`[VIDEO ${videoUid}] MP4 is ready, initiating R2 upload`);
        
        try {
          // Call the upload-to-r2 API
          const response = await fetch('http://localhost:3000/api/cloudflare/upload-to-r2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Source': 'cloudflare-monitor'
            },
            body: JSON.stringify({ videoUid }),
          });
          
          if (response.ok) {
            logger.info(`[VIDEO ${videoUid}] Successfully initiated R2 upload`);
          } else {
            logger.warn(`[VIDEO ${videoUid}] Failed to initiate R2 upload: ${response.status}`);
          }
        } catch (r2Error) {
          logger.error(`[VIDEO ${videoUid}] Error calling upload-to-r2 API: ${r2Error.message}`);
        }
      }
    }
    
    // Only monitor videos in early states (before MP4 processing begins)
    // This creates a clean handoff to the API endpoints
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .in('status', ['uploading', 'queued', 'processing', 'stream_ready']) 
      .is('processing_details->mp4_processing_started', null) // Only videos not yet processed by enable-mp4
      .is('processing_details->handoff_to_mp4_processing', null) // Also exclude videos already handed off to enable-mp4
      .order('uploaded_at', { ascending: true });

    if (error) {
      logger.error(`[MONITOR] ERROR: Cannot fetch videos: ${error.message}`);
      throw error;
    }

    if (!data?.length) {
      logger.info(`[MONITOR] No videos to check`);
      return;
    }

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
        
        // Update database with current status
        logger.info(`[VIDEO ${cloudflareUid}] Updating database...`);
        
        // Special handling for 'ready' state - this is our handoff point
        if (cloudflareData.status.state === 'ready') {
          // First check if this video has already started MP4 processing
          const { data: currentState } = await supabase
            .from('clips')
            .select('status, processing_details')
            .eq('cloudflare_uid', cloudflareUid)
            .single();
          
          // Check ALL possible MP4 and R2 related statuses to avoid any cycling
          const inMp4Process = currentState && [
            'mp4_processing', 
            'waitformp4', 
            'mp4downloading', 
            'r2_uploading'
          ].includes(currentState.status);
          
          // Also check if MP4 processing has started in any way
          const mp4Started = currentState?.processing_details?.mp4_processing_started ||
                            currentState?.processing_details?.mp4_poll_started ||
                            currentState?.processing_details?.mp4_status === 'polling';
          
          // Log thorough status information
          logger.info(`[VIDEO ${cloudflareUid}] Current status: ${currentState?.status}, MP4 process started: ${mp4Started ? 'YES' : 'NO'}`);
          
          if (inMp4Process || mp4Started) {
            logger.info(`[VIDEO ${cloudflareUid}] Already in MP4 processing flow: ${currentState?.status}. Skipping duplicate enable-mp4 call to prevent status cycling.`);
            completedVideos.add(cloudflareUid); // Mark as completed from index.js perspective
            processingVideos.delete(cloudflareUid);
            continue; // Continue to next video since we're in a loop
          }
          
          // Mark as stream_ready but also add flag to prevent reprocessing
          logger.info(`[VIDEO ${cloudflareUid}] Setting handoff_to_mp4_processing flag to prevent future enable-mp4 calls`);
          await supabase
            .from('clips')
            .update({
              status: 'stream_ready',
              processing_details: {
                ...(video.processing_details || {}),
                cloudflare_status: 'ready',
                progress: cloudflareData.status.pctComplete || 0,
                last_checked: new Date().toISOString(),
                handoff_to_mp4_processing: true, // This flag signals that index.js has done its job
                handoff_time: new Date().toISOString() // Record when handoff occurred for debugging
              }
            })
            .eq('cloudflare_uid', cloudflareUid);
            
          logger.info(`[VIDEO ${cloudflareUid}] Video is READY. Handing off to enable-mp4 API...`);
          
          try {
            // Check if we've already attempted a handoff before calling the API
            if (video.processing_details?.handoff_to_mp4_processing) {
              logger.info(`[VIDEO ${cloudflareUid}] Handoff flag already set, skipping duplicate enable-mp4 API call`);
              completedVideos.add(cloudflareUid); // Mark as completed from index.js perspective
              continue;
            }
            
            // Call the enable-mp4 API and then stop tracking this video
            const response = await fetch('http://localhost:3000/api/cloudflare/enable-mp4', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Source': 'cloudflare-monitor' // Add source header to identify where call is coming from
              },
              body: JSON.stringify({ videoUid: cloudflareUid }),
            });
            
            if (response.ok) {
              logger.info(`[VIDEO ${cloudflareUid}] Successfully handed off to enable-mp4 API`);
              completedVideos.add(cloudflareUid); // Mark as completed from index.js perspective
            } else {
              logger.warn(`[VIDEO ${cloudflareUid}] Failed to hand off to enable-mp4 API: ${response.status}`);
            }
          } catch (apiError) {
            logger.error(`[VIDEO ${cloudflareUid}] Error calling enable-mp4 API: ${apiError.message}`);
          }
        } else {
          // Continue with normal processing for non-ready states
          const isComplete = await updateDatabaseStatus(cloudflareUid, cloudflareData);

          if (isComplete) {
            logger.info(`[VIDEO ${cloudflareUid}] COMPLETED: Processing finished`);
            completedVideos.add(cloudflareUid);
          } else {
            logger.info(`[VIDEO ${cloudflareUid}] Still processing: ${cloudflareData.status.state}`);
          }
        }

        // Remove from processing set
        processingVideos.delete(cloudflareUid);
        } catch (error) {
        logger.error(`[VIDEO ${video.cloudflare_uid}] ERROR: ${error.message}`);
          processingVideos.delete(video.cloudflare_uid);
          await handleVideoError(video, error);
        }
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
    processing_details: {
      ...(video.processing_details || {}),
      error_message: error.message,
      error_type: error.message === 'VIDEO_NOT_FOUND' ? 'not_found_in_cloudflare' : 'processing_error',
      error_time: new Date().toISOString(),
      checked_at: new Date().toISOString()
    }
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

