import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/PendingUploadsBanner.module.css';
import { MdSync, MdExpandMore, MdExpandLess, MdCancel } from 'react-icons/md';
import { FaCloudUploadAlt } from 'react-icons/fa';

/**
 * A simplified component that displays currently processing uploads for the current user
 */
const PendingUploadsBanner = ({ userId }) => {
  const [uploads, setUploads] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const { supabase } = useAuth();
  const [cancellingIds, setCancellingIds] = useState([]);

  // Fetch uploads that are currently being processed
  const fetchUploads = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['uploading', 'queued', 'processing', 'stream_ready', 'waitformp4', 'mp4downloading', 'mp4_processing', 'r2_uploading'])
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
      return;
    }
    
    const processingStatuses = ['uploading', 'queued', 'processing', 'stream_ready', 'waitformp4', 'mp4downloading', 'mp4_processing', 'r2_uploading'];
    
    if (payload.eventType === 'INSERT' && processingStatuses.includes(updatedClip.status)) {
      // Add new clip if it's in processing status
      setUploads(prev => [updatedClip, ...prev].sort((a, b) => 
        new Date(b.uploaded_at) - new Date(a.uploaded_at)
      ));
      return;
    }
    
    if (payload.eventType === 'UPDATE') {
      if (!processingStatuses.includes(updatedClip.status)) {
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
  
  // If no uploads, don't show anything
  if (!uploads.length) return null;
  
  return (
    <div className={styles.bannerContainer}>
      <div className={styles.bannerHeader}>
        <div className={styles.bannerTitle}>
          <MdSync className={styles.spinning} />
          <h3>Processing Videos ({uploads.length})</h3>
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
          {uploads.map(upload => {
            const progress = getProgressPercentage(upload);
            const statusText = getStatusLabel(upload.status);
            const isCancelling = cancellingIds.includes(upload.id);
            // Determine if upload is cancellable based on status
            const isCancellable = ['uploading', 'queued', 'processing', 'stream_ready'].includes(upload.status);
            
            return (
              <div key={upload.id} className={styles.uploadItem}>
                <div className={styles.uploadIcon}>
                  <FaCloudUploadAlt />
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

// Helper functions to display status information
function getStatusLabel(status) {
  switch (status) {
    case 'uploading': return 'Uploading to server...';
    case 'queued': return 'Queued for processing...';
    case 'processing': return 'Processing video...';
    case 'stream_ready': return 'Ready for MP4 creation...';
    case 'waitformp4': return 'Creating MP4 version...';
    case 'mp4downloading': return 'Downloading MP4...';
    case 'mp4_processing': return 'Processing MP4...';
    case 'r2_uploading': return 'Uploading to storage...';
    default: return 'Processing...';
  }
}

function getProgressPercentage(upload) {
  const { status } = upload;
  
  // Return specific percentage based on the status
  switch (status) {
    case 'uploading': return 15;
    case 'queued': return 30;
    case 'processing': return 50;
    case 'stream_ready': return 60;
    case 'mp4_processing': return 70;
    case 'waitformp4': return 80;
    case 'mp4downloading': return 90;
    case 'r2_uploading': return 95;
    default: return 50;
  }
}

// Function to get different colors based on the stage in the process
function getProgressColor(status) {
  switch (status) {
    case 'uploading':
    case 'queued':
      return '#4a90e2'; // Blue for early stages
    case 'processing':
    case 'stream_ready':
    case 'waitformp4':
      return '#f5a623'; // Orange for middle stages
    case 'mp4downloading':
    case 'mp4_processing':
    case 'r2_uploading':
      return '#7ed321'; // Green for final stages
    default:
      return '#4a90e2'; // Default blue
  }
}

export default PendingUploadsBanner; 