import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import fetch from 'node-fetch';

// ============= CONFIGURATIONS =============
const CONFIG = {
  TIMEOUTS: {
    PENDING_UPLOAD: 15, // minutes
    CHECK_INTERVAL: 10, // seconds
    HEALTH_CHECK: 5 // minutes
  },
  STATES: {
    FINAL: ['ready', 'error', 'cancelled'],
    PENDING: ['pendingupload', 'uploading', 'video_in_queue', 'processing']
  },
  STATUS_MAPPING: {
    'pendingupload': 'newbutmaybecanceled',
    'queued': 'video_in_queue',
    'inprogress': 'processing',
    'ready': 'ready',
    'error': 'error'
  }
};

// Initialize logger
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

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Cloudflare configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// ============= STATE TRACKING =============
const completedVideos = new Set(); // For final states
const handledVideos = new Set(); // For tracking handled videos
const processingVideos = new Set(); // For currently processing videos

// Add timeout constants
const MS_PER_MINUTE = 60 * 1000;

// Add retry mechanism
const retry = async (fn, retries = 3, delay = 5000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    logger.warn(`Retrying after error: ${error.message}. Attempts left: ${retries}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 1.5); // Exponential backoff
  }
};

// ============= CORE FUNCTIONS =============
async function getCloudflareStatus(uid) {
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

    if (response.status === 404) {
      // Video not found in Cloudflare, mark as cancelled
      logger.warn(`Video ${uid} not found in Cloudflare`);
      await supabase
        .from('media_clips')
        .update({
          status: 'videowillbecanceled',
          error_message: 'Video not found in Cloudflare',
          metadata: {
            error_type: 'not_found_in_cloudflare',
            checked_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
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

// Add this new function to delete video from Cloudflare
async function deleteCloudflareVideo(uid) {
  try {
    // First delete the downloads
    const downloadResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}/downloads`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!downloadResponse.ok) {
      logger.warn(`Failed to delete downloads for ${uid}: ${downloadResponse.statusText}`);
    }

    // Then delete the video itself
    const videoResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!videoResponse.ok) {
      throw new Error(`Failed to delete video: ${videoResponse.statusText}`);
    }

    // Delete the database row
    const { error } = await supabase
      .from('media_clips')
      .delete()
      .eq('cloudflare_uid', uid);

    if (error) throw error;

    logger.info(`Successfully deleted video ${uid} from Cloudflare and database`);
    return true;
  } catch (error) {
    logger.error(`Error deleting video ${uid}:`, error);
    throw error;
  }
}

// Modify the updateDatabaseStatus function's timeout handling
async function updateDatabaseStatus(uid, cloudflareData) {
  try {
    const dbStatus = CONFIG.STATUS_MAPPING[cloudflareData.status.state] || cloudflareData.status.state;
    
    // Check current status first
    const { data: currentData, error: checkError } = await supabase
      .from('media_clips')
      .select('status, processing_progress, updated_at, uploaded_at, metadata')
      .eq('cloudflare_uid', uid)
      .single();

    if (checkError) throw checkError;

    // Check for pending timeout
    if (cloudflareData.status.state === 'pendingupload') {
      const startTime = new Date(currentData.uploaded_at);
      const now = new Date();
      const minutesElapsed = (now - startTime) / MS_PER_MINUTE;

      logger.info(`Checking timeout for ${uid}:`, {
        minutesElapsed,
        startTime: currentData.uploaded_at,
        currentStatus: currentData.status,
        elapsedMinutes: Math.round(minutesElapsed)
      });

      if (minutesElapsed > CONFIG.TIMEOUTS.PENDING_UPLOAD) {
        logger.warn(`Video ${uid} stuck in pendingupload for ${Math.round(minutesElapsed)} minutes, deleting video`);
        
        await deleteCloudflareVideo(uid);
        completedVideos.add(uid);
        return true;
      }
    }

    // For status updates, maintain metadata
    const metadata = {
      ...(currentData.metadata || {}),
      cloudflare_status: cloudflareData.status.state,
      processing_step: cloudflareData.status.step,
      error_code: cloudflareData.status.errorReasonCode,
      last_checked: new Date().toISOString(),
      processing_complete: CONFIG.STATES.FINAL.includes(cloudflareData.status.state),
      upload_start: currentData.uploaded_at // Always maintain upload start time
    };

    // Skip if status and progress haven't changed and not in pending state
    if (currentData.status === dbStatus && 
        currentData.processing_progress === cloudflareData.status.pctComplete &&
        dbStatus !== 'pendingupload') {
      logger.info(`No changes for ${uid}, skipping update`);
      return CONFIG.STATES.FINAL.includes(dbStatus);
    }

    const { error } = await supabase
      .from('media_clips')
      .update({
        status: dbStatus,
        processing_progress: cloudflareData.status.pctComplete || 0,
        ready_to_stream: cloudflareData.readyToStream,
        duration: cloudflareData.duration,
        file_size: cloudflareData.size,
        thumbnail_url: cloudflareData.thumbnail,
        hls_url: cloudflareData.playback?.hls,
        dash_url: cloudflareData.playback?.dash,
        error_message: cloudflareData.status.errorReasonText,
        metadata,
        updated_at: new Date().toISOString()
      })
      .eq('cloudflare_uid', uid);

    if (error) throw error;

    logger.info(`Updated status for ${uid}:`, { 
      cloudflareState: cloudflareData.status.state,
      dbStatus,
      progress: cloudflareData.status.pctComplete,
      isComplete: CONFIG.STATES.FINAL.includes(dbStatus)
    });

    return CONFIG.STATES.FINAL.includes(dbStatus);
  } catch (error) {
    logger.error(`Failed to update database for ${uid}:`, error);
    throw error;
  }
}

async function handleVideoError(video, error) {
  const errorUpdate = {
    status: 'error',
    error_message: error.message,
    metadata: {
      error_type: error.message === 'VIDEO_NOT_FOUND' 
        ? 'not_found_in_cloudflare' 
        : 'processing_error',
      checked_at: new Date().toISOString()
    }
  };

  await supabase
    .from('media_clips')
    .update(errorUpdate)
    .eq('cloudflare_uid', video.cloudflare_uid);

  handledVideos.add(video.cloudflare_uid);
}

// ============= MONITORING LOGIC =============
async function monitorPendingVideos() {
  try {
    const { data, error } = await supabase
      .from('media_clips')
      .select('*')
      .in('status', [
        'pendingupload',
        'newbutmaybecanceled',
        'uploading',
        'video_in_queue'
      ])
      .order('uploaded_at', { ascending: true });

    if (error) throw error;
    if (!data?.length) return;

    logger.info(`Monitoring ${data.length} pending videos`);

    for (const video of data) {
      try {
        // Skip if already handled or being processed
        if (handledVideos.has(video.cloudflare_uid) || 
            processingVideos.has(video.cloudflare_uid)) {
          logger.info(`Skipping ${video.cloudflare_uid} - already handled/processing`);
          continue;
        }

        // Mark as processing
        processingVideos.add(video.cloudflare_uid);

        const startTime = new Date(video.uploaded_at);
        const now = new Date();
        const minutesElapsed = (now - startTime) / MS_PER_MINUTE;

        logger.info(`Checking pending video ${video.cloudflare_uid}:`, {
          status: video.status,
          minutesElapsed: Math.round(minutesElapsed),
          uploadedAt: video.uploaded_at
        });

        const cloudflareData = await getCloudflareStatus(video.cloudflare_uid);
        const isComplete = await updateDatabaseStatus(video.cloudflare_uid, cloudflareData);

        if (isComplete) {
          logger.info(`Video ${video.cloudflare_uid} completed processing`);
          completedVideos.add(video.cloudflare_uid);
          handledVideos.add(video.cloudflare_uid);
        }

        // Remove from processing
        processingVideos.delete(video.cloudflare_uid);
      } catch (error) {
        processingVideos.delete(video.cloudflare_uid);
        await handleVideoError(video, error);
      }
    }
  } catch (error) {
    logger.error('Error monitoring pending videos:', error);
  }
}

async function catchUpWithPendingVideos() {
  try {
    logger.info('Catching up with pending videos...');
    
    // Add health check
    const { error: healthCheckError } = await supabase.from('media_clips').select('count').limit(1);
    if (healthCheckError) {
      throw new Error(`Database health check failed: ${healthCheckError.message}`);
    }
    
    const { data, error } = await supabase
      .from('media_clips')
      .select('*')
      .in('status', [
        'pendingupload',
        'uploading',
        'video_in_queue',
        'processing',
        'inprogress',
        'newbutmaybecanceled'
      ])
      .order('uploaded_at', { ascending: true });

    if (error) throw error;

    if (!data?.length) {
      logger.info('No pending videos found to catch up with');
      return;
    }

    logger.info(`Found ${data.length} pending videos to catch up with`);

    const BATCH_SIZE = 5;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (video) => {
        try {
          // Skip if already handled or being processed
          if (handledVideos.has(video.cloudflare_uid) || 
              processingVideos.has(video.cloudflare_uid)) {
            return;
          }

          processingVideos.add(video.cloudflare_uid);

          const processVideo = async () => {
            const cloudflareData = await getCloudflareStatus(video.cloudflare_uid);
            return await updateDatabaseStatus(video.cloudflare_uid, cloudflareData);
          };

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Processing timeout')), 30000);
          });

          const isComplete = await Promise.race([
            retry(() => processVideo()),
            timeoutPromise
          ]);

          if (isComplete) {
            logger.info(`Caught up video ${video.cloudflare_uid} is complete`);
            completedVideos.add(video.cloudflare_uid);
            handledVideos.add(video.cloudflare_uid);
          }

          processingVideos.delete(video.cloudflare_uid);
        } catch (error) {
          processingVideos.delete(video.cloudflare_uid);
          await handleVideoError(video, error);
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('Catch-up process completed');
  } catch (error) {
    logger.error('Error during catch-up process:', error);
    setTimeout(catchUpWithPendingVideos, 10000);
  }
}

// Initialize Supabase realtime subscription
async function initializeSubscription() {
  try {
    logger.info('Initializing Supabase subscription...');

    const channel = supabase.channel('media_clips_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_clips'
        },
        async (payload) => {
          const { new: newRecord, old: oldRecord } = payload;
    
          if (!newRecord?.cloudflare_uid) {
            logger.info('Skipping record without cloudflare_uid');
            return;
          }

          // Skip if already handled or being processed
          if (handledVideos.has(newRecord.cloudflare_uid) || 
              processingVideos.has(newRecord.cloudflare_uid)) {
            logger.info(`Skipping ${newRecord.cloudflare_uid} - already handled/processing`);
            return;
          }

          // Skip if already completed or cancelled
          if (completedVideos.has(newRecord.cloudflare_uid) || 
              CONFIG.STATES.FINAL.includes(newRecord.status) ||
              newRecord.status === 'cancelled' ||
              newRecord.status === 'videowillbecanceled') {
            logger.info(`Skipping completed/cancelled video ${newRecord.cloudflare_uid}`);
            completedVideos.add(newRecord.cloudflare_uid);
            handledVideos.add(newRecord.cloudflare_uid);
            return;
          }

          // Skip if no status change
          if (oldRecord && oldRecord.status === newRecord.status) {
            logger.info(`Skipping ${newRecord.cloudflare_uid} - no status change`);
            return;
          }

          processingVideos.add(newRecord.cloudflare_uid);

          try {
            logger.info(`Processing video ${newRecord.cloudflare_uid}`, {
              event: payload.eventType,
              currentStatus: newRecord.status,
              oldStatus: oldRecord?.status
            });

            const cloudflareData = await getCloudflareStatus(newRecord.cloudflare_uid);
            const isComplete = await updateDatabaseStatus(newRecord.cloudflare_uid, cloudflareData);
            
            if (isComplete) {
              logger.info(`Marking ${newRecord.cloudflare_uid} as complete`);
              completedVideos.add(newRecord.cloudflare_uid);
              handledVideos.add(newRecord.cloudflare_uid);
            }

            processingVideos.delete(newRecord.cloudflare_uid);
          } catch (error) {
            processingVideos.delete(newRecord.cloudflare_uid);
            if (error.message === 'VIDEO_NOT_FOUND') {
              logger.info(`Video ${newRecord.cloudflare_uid} not found in Cloudflare`);
              completedVideos.add(newRecord.cloudflare_uid);
              handledVideos.add(newRecord.cloudflare_uid);
            } else {
              logger.error(`Error processing video ${newRecord.cloudflare_uid}:`, error);
              await handleVideoError(newRecord, error);
            }
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Successfully subscribed to media_clips changes');
          await catchUpWithPendingVideos();
          
          setInterval(async () => {
            try {
              await monitorPendingVideos();
            } catch (error) {
              logger.error('Pending videos check failed:', error);
            }
          }, CONFIG.TIMEOUTS.CHECK_INTERVAL * 1000);

          setInterval(async () => {
            try {
              await catchUpWithPendingVideos();
            } catch (error) {
              logger.error('Health check failed:', error);
            }
          }, CONFIG.TIMEOUTS.HEALTH_CHECK * 60 * 1000);
        }
      });

    channel.on('error', (error) => {
      logger.error('Supabase channel error:', error);
    });

    channel.on('disconnect', () => {
      logger.warn('Supabase channel disconnected, attempting to reconnect...');
    });

  } catch (error) {
    logger.error('Error initializing subscription:', error);
    throw error;
  }
}

// Start the service
initializeSubscription().catch(error => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await supabase.removeAllChannels();
  process.exit(0);
}); 