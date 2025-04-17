import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Status order definition - determines valid progression paths
 * Higher numbers should come after lower numbers in the progression
 */
export const STATUS_ORDER = {
  'uploading': 1,     // Initial upload to Cloudflare
  'queued': 2,        // Queued for processing in Cloudflare
  'processing': 3,    // Processing by Cloudflare
  'stream_ready': 4,  // Ready for streaming but no MP4 yet
  'waitformp4': 5,    // Waiting for MP4 to be generated
  'mp4_processing': 6, // MP4 is being processed
  'mp4downloading': 7, // MP4 is being downloaded
  'r2_uploading': 8,   // Uploading to R2 storage
  'complete': 9,       // Processing complete
  'error': 10          // Error state (can happen at any point)
};

/**
 * Map from Cloudflare states to our internal states
 */
export const CLOUDFLARE_STATUS_MAPPING = {
  pendingupload: 'uploading',  // Initial upload to Cloudflare
  inprogress: 'processing',    // Cloudflare processing the video
  ready: 'stream_ready',       // Basic Cloudflare processing complete
  error: 'error',              // Processing error
};

/**
 * Get a human-readable status message for the current processing state
 * 
 * @param {string} status - The current status
 * @param {string} cloudflareStatus - Raw status from Cloudflare (optional)
 * @returns {string} Human-readable status message
 */
export function getStatusMessage(status, cloudflareStatus = null) {
  switch (status) {
    case 'uploading':
      return 'Uploading video to Cloudflare...';
    case 'queued':
      return 'Queued for processing...';
    case 'processing':
      return 'Cloudflare is processing your video...';
    case 'stream_ready':
      return 'Preparing to create MP4 version...';
    case 'waitformp4':
      return 'Creating MP4 version...';
    case 'mp4_processing':
      return 'Processing MP4 file...';
    case 'mp4downloading':
      return 'Downloading MP4 file...';
    case 'r2_uploading':
      return 'Uploading to permanent storage...';
    case 'complete':
      return 'Processing complete';
    case 'error':
      return 'Error processing video';
    default:
      return cloudflareStatus ? `Processing... (${cloudflareStatus})` : 'Processing...';
  }
}

/**
 * Get the minimum progress percentage for a given status
 * This ensures progress never moves backward in the UI
 * 
 * @param {string} status - Processing status
 * @returns {number} Minimum progress percentage
 */
export function getMinProgressForStatus(status) {
  switch (status) {
    case 'uploading': return 15;
    case 'queued': return 30;
    case 'processing': return 50;
    case 'stream_ready': return 60;
    case 'waitformp4': return 70;
    case 'mp4_processing': return 75;
    case 'mp4downloading': return 85;
    case 'r2_uploading': return 95;
    case 'complete': return 100;
    case 'error': return 100; // Errors still show full progress bar
    default: return 0;
  }
}

/**
 * Update ONLY the processing_details without changing status
 * This avoids status cycling by letting the main index.js handle all status changes
 * 
 * @param {string} videoUid - Cloudflare video UID from clips.cloudflare_uid
 * @param {object} details - New processing details to merge with existing ones
 * @param {string} logPrefix - Prefix for log messages (e.g., 'R2' or 'MP4')
 * @returns {Promise<boolean>} Success status
 */
export async function updateProcessingDetails(videoUid, details = {}, logPrefix = 'Status') {
  try {
    console.log(`[${logPrefix}-Details] Updating processing details:`, details);
    
    // First get current data
    const { data: currentData } = await supabase
      .from('clips')
      .select('processing_details')
      .eq('cloudflare_uid', videoUid)
      .single();
      
    if (!currentData) {
      console.log(`[${logPrefix}-Details] Warning: Video ${videoUid} not found in database`);
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
      console.log(`[${logPrefix}-Details] Warning: Failed to update processing details: ${updateError.message}`);
      return false;
    } else {
      console.log(`[${logPrefix}-Details] Successfully updated processing details`);
      return true;
    }
  } catch (error) {
    console.log(`[${logPrefix}-Details] Error updating details: ${error.message}`);
    return false;
  }
}

/**
 * Signal that we need a status update
 * This adds flags to trigger index.js to update the status accordingly
 * 
 * @param {string} videoUid - Cloudflare video UID from clips.cloudflare_uid
 * @param {string} nextStatus - The requested status to change to
 * @param {object} details - Additional processing details to include
 * @param {string} logPrefix - Prefix for log messages (e.g., 'R2' or 'MP4')
 * @returns {Promise<boolean>} Success status
 */
export async function signalStatusUpdate(videoUid, nextStatus, details = {}, logPrefix = 'Status') {
  try {
    console.log(`[${logPrefix}-Signal] Signaling for status update to: ${nextStatus}`);
    
    // Set the flag for the requested status update
    const updateDetails = {
      ...details,
      requested_status: nextStatus,
      status_request_time: new Date().toISOString()
    };
    
    return await updateProcessingDetails(videoUid, updateDetails, logPrefix);
  } catch (error) {
    console.log(`[${logPrefix}-Signal] Error signaling status update: ${error.message}`);
    return false;
  }
}

/**
 * Check if a status transition is valid according to our status order
 * 
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - New status to transition to
 * @returns {boolean} Whether the transition is valid
 */
export function isValidStatusTransition(currentStatus, newStatus) {
  // Error can always be set
  if (newStatus === 'error') return true;
  
  // Allow cycling between mp4_processing and waitformp4
  if (currentStatus === 'mp4_processing' && newStatus === 'waitformp4') return true;
  if (currentStatus === 'waitformp4' && newStatus === 'mp4_processing') return true;
  
  // For all other transitions, new status must be higher in order
  if (!STATUS_ORDER[currentStatus] || !STATUS_ORDER[newStatus]) return false;
  return STATUS_ORDER[newStatus] > STATUS_ORDER[currentStatus];
}

/**
 * Get video details from the clips table using the Cloudflare UID
 * 
 * @param {string} videoUid - Cloudflare video UID
 * @returns {Promise<Object>} Video data or null if not found
 */
export async function getVideoByCloudflareId(videoUid) {
  try {
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();
      
    if (error) {
      console.log(`Error fetching video with cloudflare_uid ${videoUid}: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.log(`Exception fetching video: ${error.message}`);
    return null;
  }
}

/**
 * Find all videos with requested status changes
 * 
 * @param {number} limit - Maximum number of videos to fetch
 * @returns {Promise<Array>} Array of videos with requested status changes
 */
export async function getVideosWithRequestedStatusChanges(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .not('processing_details->requested_status', 'is', null)
      .order('uploaded_at', { ascending: true })
      .limit(limit);
      
    if (error) {
      console.log(`Error fetching videos with requested status changes: ${error.message}`);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.log(`Exception fetching videos with status changes: ${error.message}`);
    return [];
  }
} 