import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/PendingUploadsBanner.module.css';
import { MdSync, MdExpandMore, MdExpandLess, MdCancel, MdCheckCircle } from 'react-icons/md';
import { FaCloudUploadAlt } from 'react-icons/fa';

/**
 * A banner component that displays currently processing uploads for the current user
 * Uses standardized status names throughout the video processing pipeline
 * Shows completed videos for 2 seconds before hiding them
 */
const PendingUploadsBanner = ({ userId }) => {
  const [uploads, setUploads] = useState([]);
  const [completedUploads, setCompletedUploads] = useState([]); // Track recently completed uploads
  const [isExpanded, setIsExpanded] = useState(false);
  const { supabase } = useAuth();
  const [cancellingIds, setCancellingIds] = useState([]);

  // List of statuses that are considered "in progress"
  const PROCESSING_STATUSES = [
    'uploading',      // Initial upload to Cloudflare
    'queue',          // Queued in Cloudflare
    'processing',     // Processing by Cloudflare
    'ready_to_stream', // Ready to stream from Cloudflare
    'mp4_processing',  // MP4 version being processed
    'mp4_downloading', // MP4 is being downloaded
    'r2_uploading'     // MP4 is being uploaded to R2
    // 'complete' status is not included as those should be hidden after 2 seconds
  ];

  // Fetch uploads that are currently being processed
  const fetchUploads = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('user_id', userId)
        .in('status', PROCESSING_STATUSES)
        .order('uploaded_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching uploads:', error);
        return;
      }
      
      setUploads(data || []);
    } catch (error) {
      console.error('Failed to fetch uploads:', error);
    }
  }, [supabase, userId]);
  
  // Function to handle cancellation of a video
  const handleCancelUpload = useCallback(async (videoId, videoUid) => {
    if (!videoId || !userId) return;
    
    // Add to cancelling state to show loading indicator
    setCancellingIds(prev => [...prev, videoId]);
    
    try {
      console.log(`Cancelling upload for video ID: ${videoId}, UID: ${videoUid || 'unknown'}`);
      
      // Call the delete video API
      const response = await fetch('/api/cloudflare/delete-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoId,
          videoUid: videoUid,
          userId: userId
        }),
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (response.ok) {
        console.log(`Successfully cancelled upload for video ID: ${videoId}`, data);
        // Remove from local state (will be updated by realtime too)
        setUploads(prev => prev.filter(upload => upload.id !== videoId));
      } else {
        console.error(`Failed to cancel upload for video ID: ${videoId}:`, data);
        alert(`Failed to cancel: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error cancelling upload for video ID: ${videoId}:`, error);
      alert(`Error cancelling upload: ${error.message || 'Unknown error'}`);
    } finally {
      // Remove from cancelling state regardless of outcome
      setCancellingIds(prev => prev.filter(id => id !== videoId));
    }
  }, [userId]);

  // Handle real-time updates to individual clips
  const handleRealtimeUpdate = useCallback((payload) => {
    // Get the updated record
    const updatedClip = payload.new;
    const oldClip = payload.old;
    
    if (payload.eventType === 'DELETE') {
      // Remove the clip if it was deleted
      setUploads(prev => prev.filter(clip => clip.id !== oldClip.id));
      setCompletedUploads(prev => prev.filter(clip => clip.id !== oldClip.id));
      return;
    }
    
    if (payload.eventType === 'INSERT' && PROCESSING_STATUSES.includes(updatedClip.status)) {
      // Add new clip if it's in processing status
      setUploads(prev => [updatedClip, ...prev].sort((a, b) => 
        new Date(b.uploaded_at) - new Date(a.uploaded_at)
      ));
      return;
    }
    
    if (payload.eventType === 'UPDATE') {
      // Check if the status has changed to complete
      if (updatedClip.status === 'complete' && oldClip.status !== 'complete') {
        // If status changed to complete, add to completedUploads temporarily
        setCompletedUploads(prev => [...prev, { ...updatedClip, completedAt: new Date() }]);
        // And remove from regular uploads
        setUploads(prev => prev.filter(clip => clip.id !== updatedClip.id));
      } else if (!PROCESSING_STATUSES.includes(updatedClip.status)) {
        // Remove clip if it's no longer in a processing status
        setUploads(prev => prev.filter(clip => clip.id !== updatedClip.id));
      } else {
        // Update the clip if it's still in a processing status
        setUploads(prev => 
          prev.map(clip => clip.id === updatedClip.id ? updatedClip : clip)
        );
      }
      return;
    }
  }, []);

  // Clean up completed uploads after 2 seconds
  useEffect(() => {
    if (completedUploads.length === 0) return;
    
    const now = new Date();
    const toRemove = [];
    
    // Check which uploads have been completed for more than 2 seconds
    completedUploads.forEach(upload => {
      const timeDiff = now - new Date(upload.completedAt);
      if (timeDiff > 2000) { // 2 seconds
        toRemove.push(upload.id);
      }
    });
    
    // Remove uploads that have been shown for more than 2 seconds
    if (toRemove.length > 0) {
      setCompletedUploads(prev => 
        prev.filter(upload => !toRemove.includes(upload.id))
      );
    }
    
    // Set interval to check every 500ms
    const interval = setInterval(() => {
      const now = new Date();
      const toRemove = [];
      
      completedUploads.forEach(upload => {
        const timeDiff = now - new Date(upload.completedAt);
        if (timeDiff > 2000) { // 2 seconds
          toRemove.push(upload.id);
        }
      });
      
      if (toRemove.length > 0) {
        setCompletedUploads(prev => 
          prev.filter(upload => !toRemove.includes(upload.id))
        );
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [completedUploads]);

  // Setup real-time subscription
  useEffect(() => {
    if (!userId) return;
    
    // Initial fetch
    fetchUploads();
    
    // Setup real-time subscription
    const channel = supabase
      .channel('clips_status_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clips',
        filter: `user_id=eq.${userId}`
      }, handleRealtimeUpdate)
      .subscribe();
    
    // Refresh every 30 seconds as a backup
    const interval = setInterval(fetchUploads, 30000);
    
    // Setup global refresh function
    window.forceRefreshUploads = fetchUploads;
    
    // Listen for custom refresh event
    const handleCustomRefresh = () => fetchUploads();
    window.addEventListener('refreshUploads', handleCustomRefresh);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.forceRefreshUploads = null;
      window.removeEventListener('refreshUploads', handleCustomRefresh);
    };
  }, [supabase, userId, fetchUploads, handleRealtimeUpdate]);
  
  // Combine current uploads and recently completed uploads for display
  const allUploads = [...uploads, ...completedUploads].sort((a, b) => 
    new Date(b.uploaded_at) - new Date(a.uploaded_at)
  );

  // Handle conditional rendering based on state
  if (allUploads.length === 0) return null;
  
  return (
    <div className={styles.bannerContainer}>
      <div className={styles.bannerHeader}>
        <div className={styles.bannerTitle}>
          <MdSync className={styles.spinning} />
          <h3>Processing Videos ({allUploads.length})</h3>
        </div>
        <button 
          className={styles.expandButton}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
        </button>
      </div>
      
      {isExpanded && (
        <div className={styles.uploadsList}>
          {allUploads.map(upload => {
            const progress = getProgressPercentage(upload);
            const statusText = getStatusLabel(upload.status);
            const isCancelling = cancellingIds.includes(upload.id);
            // Determine if upload is cancellable based on status
            const isCancellable = ['uploading', 'queue', 'processing'].includes(upload.status);
            const isComplete = upload.status === 'complete';
            
            return (
              <div key={upload.id} className={`${styles.uploadItem} ${isComplete ? styles.completeItem : ''}`}>
                <div className={styles.uploadIcon}>
                  {isComplete ? <MdCheckCircle className={styles.completeIcon} /> : <FaCloudUploadAlt />}
                </div>
                <div className={styles.uploadInfo}>
                  <div className={styles.uploadTitle}>{upload.title || 'Untitled'}</div>
                  <div className={styles.uploadStatus}>
                    <div className={styles.statusText}>
                      {statusText} <span className={styles.progressPercent}>{progress}%</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill}
                        style={{ 
                          width: `${progress}%`,
                          backgroundColor: getProgressColor(upload.status)
                        }}
                      />
                    </div>
                  </div>
                </div>
                {isCancellable && (
                  <button 
                    className={styles.cancelButton}
                    onClick={() => handleCancelUpload(upload.id, upload.cloudflare_uid)}
                    disabled={isCancelling}
                    aria-label="Cancel upload"
                    title="Cancel upload"
                  >
                    {isCancelling ? (
                      <div className={styles.smallSpinner}></div>
                    ) : (
                      <MdCancel />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Returns a user-friendly label for each status state
 */
function getStatusLabel(status) {
  switch (status) {
    case 'uploading': return 'Uploading to Cloudflare...';
    case 'queue': return 'Queued for processing...';
    case 'processing': return 'Processing video...';
    case 'ready_to_stream': return 'Ready for MP4 creation...';
    case 'mp4_processing': return 'Creating MP4 version...';
    case 'mp4_downloading': return 'Downloading MP4...';
    case 'r2_uploading': return 'Uploading to storage...';
    case 'complete': return 'Processing complete!';
    // Handle legacy status names for backward compatibility
    case 'queued': return 'Queued for processing...';
    case 'stream_ready': return 'Ready for MP4 creation...';
    case 'waitformp4': return 'Creating MP4 version...';
    case 'mp4downloading': return 'Downloading MP4...';
    default: return 'Processing...';
  }
}

/**
 * Returns a percentage completion based on the current status
 * Each step represents progress through the full pipeline
 */
function getProgressPercentage(upload) {
  const { status } = upload;
  
  // Return specific percentage based on the status
  // More evenly distributed percentages across the pipeline
  switch (status) {
    case 'uploading': return 12;
    case 'queue': case 'queued': return 25;
    case 'processing': return 38;
    case 'ready_to_stream': case 'stream_ready': return 50;
    case 'mp4_processing': case 'waitformp4': return 65;
    case 'mp4_downloading': case 'mp4downloading': return 80;
    case 'r2_uploading': return 95;
    case 'complete': return 100;
    default: return 50;
  }
}

/**
 * Returns a color code based on the stage of processing
 * Creates a visual progression from blue to green
 */
function getProgressColor(status) {
  // Map statuses to stages for color coding
  const stage = getProcessingStage(status);
  
  // Color palette from early to late stages
  switch (stage) {
    case 1: return '#4a90e2'; // Blue - Early stages (uploading, queue)
    case 2: return '#5d8edd'; // Blue-teal - Processing
    case 3: return '#f5a623'; // Orange - Middle stages (ready_to_stream, mp4_processing)
    case 4: return '#a1d05e'; // Yellow-green - Late stages (mp4_downloading)
    case 5: return '#7ed321'; // Green - Final stages (r2_uploading)
    case 6: return '#00b74a'; // Bright Green - Complete
    default: return '#4a90e2'; // Default blue
  }
}

/**
 * Helper function to determine the processing stage for color coding
 */
function getProcessingStage(status) {
  switch (status) {
    case 'uploading': 
      return 1;
    case 'queue': 
    case 'queued':
    case 'processing': 
      return 2;
    case 'ready_to_stream': 
    case 'stream_ready':
    case 'mp4_processing': 
    case 'waitformp4':
      return 3;
    case 'mp4_downloading': 
    case 'mp4downloading':
      return 4;
    case 'r2_uploading': 
      return 5;
    case 'complete':
      return 6;
    default: 
      return 1;
  }
}

export default PendingUploadsBanner; 