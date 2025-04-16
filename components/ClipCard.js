import { useState, useCallback, useRef, useEffect } from 'react';
import { MdFavorite, MdFavoriteBorder, MdVisibility, MdPerson, MdExpandMore, 
  MdPublic, MdLock, MdDelete, MdShare, MdClose, MdSync } from 'react-icons/md';
import styles from '../styles/ClipCard.module.css';
import VideoPlayer from './VideoPlayer';
import { useLikes } from '../hooks/useLikes';
import LikesModal from './LikesModal';
import DeleteClipModal from './DeleteClipModal';
import { useAuth } from '../contexts/AuthContext';
import VisibilityModal from './VisibilityModal';
import ShareModal from './ShareModal';
import { useRouter } from 'next/router';
import ExpandedTitleModal from './ExpandedTitleModal';
import Link from 'next/link';

// Helper functions for processing status display
function getStatusLabel(status) {
  // If status is null or undefined, display "Ready"
  if (!status) return 'Ready';
  
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

function getProgressPercentage(clip) {
  // Safety check - if clip has no status or is missing, return 100% (complete)
  if (!clip || !clip.status) return 100;
  
  const { status } = clip;
  
  // Check if we have a progress value in processing_details
  if (clip.processing_details?.progress) {
    // For MP4 processing steps, ensure progress is always at least 70%
    if (['mp4_processing', 'waitformp4'].includes(status)) {
      return Math.max(70, clip.processing_details.progress);
    }
    
    // For other statuses, use the provided progress value
    return clip.processing_details.progress;
  }
  
  // Special handling for MP4 processing steps to ensure visual progress
  // This ensures the progress bar doesn't appear to go backward
  if (status === 'mp4_processing') {
    // Use higher value between default and any mp4_percent_complete from details
    return Math.max(75, clip.processing_details?.mp4_percent_complete || 75);
  }
  
  if (status === 'waitformp4') {
    // Use higher value between default and any mp4_percent_complete from details
    return Math.max(80, clip.processing_details?.mp4_percent_complete || 80);
  }
  
  // Otherwise, return specific percentage based on the status
  switch (status) {
    case 'uploading': return 15;
    case 'queued': return 30;
    case 'processing': return 50;
    case 'stream_ready': return 60;
    case 'mp4downloading': return 90;
    case 'r2_uploading': return 95;
    case 'complete': return 100;
    default: return 50;
  }
}

function getProgressColor(status) {
  // Default for undefined status
  if (!status) return '#7ed321'; // Green for completed/default
  
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

const ClipCard = ({ 
  clip, 
  isFullWidth = false, 
  onClipUpdate = null // Make it optional with default null
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);
  const titleRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { user, supabase } = useAuth();
  const [clipData, setClipData] = useState(clip);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const cardRef = useRef(null);
  const subscriptionRef = useRef(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Check if the clip is still processing
  // Add safety check - if status is missing, assume clip is complete
  const clipStatus = clipData.status || 'complete';
  const isProcessing = ['uploading', 'queued', 'processing', 'stream_ready', 
    'waitformp4', 'mp4downloading', 'mp4_processing', 'r2_uploading'].includes(clipStatus);
  
  // Log processing state for debugging
  if (isProcessing) {
    console.log(`[ClipCard] Clip ${clipData.id} is processing: status=${clipStatus}, details:`, clipData.processing_details);
  }

  // Function to refresh clip data without page refresh
  const refreshClipData = useCallback(async () => {
    if (!supabase || !clipData.id) return;
    
    console.log(`Refreshing clip data for ${clipData.id}`);
    setIsTransitioning(true); // Set transitioning state to true during refresh
    
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('id', clipData.id)
        .single();
        
      if (error) {
        console.error('Error refreshing clip data:', error);
        setIsTransitioning(false);
        return;
      }
      
      if (data) {
        console.log('Clip data refreshed:', data);
        
        // If transitioning from processing to complete, add a small delay
        if (data.status === 'complete' && isProcessing) {
          // Keep transitioning state true for a bit longer
          setTimeout(() => {
            setClipData(data);
            // Only turn off transitioning after another delay to ensure player has time to load
            setTimeout(() => setIsTransitioning(false), 1000);
          }, 500);
        } else {
          setClipData(data);
          setIsTransitioning(false);
        }
        
        // If clip is now complete and there's an update callback, call it
        if (data.status === 'complete' && typeof onClipUpdate === 'function') {
          onClipUpdate(clipData.id, 'status', data);
        }
      }
    } catch (err) {
      console.error('Failed to refresh clip data:', err);
      setIsTransitioning(false);
    }
  }, [clipData.id, supabase, onClipUpdate, isProcessing]);

  const {
    liked,
    likesCount,
    isUpdatingLike,
    likesList,
    handleLike
  } = useLikes(clipData.id, clipData.likes_count || 0, user);

  const isOwner = user?.id === clipData.user_id;
  const isPublic = clipData.visibility === 'public';

  const handleLoadingChange = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  // Set up real-time subscription for clip updates
  useEffect(() => {
    // Only set up subscription if the clip is still processing
    if (!isProcessing || !supabase) return;

    // Subscribe to changes on this specific clip
    subscriptionRef.current = supabase
      .channel(`clip-${clipData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clips',
          filter: `id=eq.${clipData.id}`
        },
        (payload) => {
          // Update the clip data when changes occur
          if (payload.new) {
            console.log('Clip updated:', payload.new);
            
            // Get the current status from the existing clipData state
            const currentStatus = clipData.status; 
            const newStatus = payload.new.status;

            // Log status change for debugging
            console.log(`[ClipCard ${clipData.id}] Status update: ${currentStatus} -> ${newStatus}`);
            
            // Define status progression order 
            const statusOrder = {
              'uploading': 1,
              'queued': 2,
              'processing': 3,
              'stream_ready': 4,
              'waitformp4': 5,
              'mp4_processing': 6,
              'mp4downloading': 7,
              'r2_uploading': 8,
              'complete': 9
            };

            // Decide if we should update the status based on progression
            const shouldUpdateStatus = 
              // Always update if status is 'complete'
              newStatus === 'complete' || 
              // Always update if we don't have the current status in our order map
              !statusOrder[currentStatus] ||
              // Only update if the new status is further along in the process
              statusOrder[newStatus] > statusOrder[currentStatus] ||
              // Special case: waitformp4 and mp4_processing can cycle between each other
              // Allow the update if they're in this cycle
              (currentStatus === 'waitformp4' && newStatus === 'mp4_processing') ||
              (currentStatus === 'mp4_processing' && newStatus === 'waitformp4');
            
            // Handle special case for mp4_processing/waitformp4 cycling
            // Don't visually "go backwards" in the progress
            if ((currentStatus === 'mp4_processing' && newStatus === 'waitformp4') ||
                (currentStatus === 'waitformp4' && newStatus === 'mp4_processing')) {
              
              // For mp4 cycling, keep the progress moving forward
              // but update other fields like processing_details for accurate information
              const mergedProcessingDetails = {
                ...payload.new.processing_details,
                status_message: 'Processing MP4...',
                // Ensure progress keeps moving forward
                progress: Math.max(
                  clipData.processing_details?.progress || 70,
                  payload.new.processing_details?.progress || 70
                )
              };
              
              // Update state with merged data
              setClipData(prev => ({
                ...prev, 
                ...payload.new,
                // Keep whichever status has higher progress value for visual consistency
                status: statusOrder[currentStatus] >= statusOrder[newStatus] 
                  ? currentStatus : newStatus,
                processing_details: mergedProcessingDetails
              }));
              
              console.log(`[ClipCard ${clipData.id}] MP4 cycle: Keeping status visual progression consistent`);
              
            } else if (newStatus === 'complete' && currentStatus !== 'complete') {
              // If status has changed to complete, set transitioning state and refresh after a delay
              console.log(`[ClipCard ${clipData.id}] Video complete! Transitioning to player`);
              setIsTransitioning(true);
              setTimeout(() => refreshClipData(), 500); // Give DB time to finalize
            } else if (shouldUpdateStatus) {
              // Normal update for progressive status changes
              console.log(`[ClipCard ${clipData.id}] Updating to new status: ${newStatus}`);
              setClipData(prev => ({...prev, ...payload.new}));
            } else {
              // For status "going backward" that's not part of mp4 cycling,
              // update all fields except status to avoid confusion
              console.log(`[ClipCard ${clipData.id}] Ignoring backward status change: ${currentStatus} -> ${newStatus}`);
              setClipData(prev => ({
                ...prev, 
                ...payload.new,
                status: prev.status // Keep current status
              }));
            }
            
            // If clip is now complete, call onClipUpdate if provided
            if (newStatus === 'complete' && typeof onClipUpdate === 'function') {
              onClipUpdate(clipData.id, 'status', payload.new);
            }
          }
        }
      )
      .subscribe();

    // Clean up subscription when component unmounts or clip is no longer processing
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [clipData.id, isProcessing, supabase, onClipUpdate, refreshClipData]);

  // Handle scroll to hide expanded title
  useEffect(() => {
    const handleScroll = () => {
      if (showFullTitle) {
        setShowFullTitle(false);
      }
      
      // Also close likes modal when scrolling
      if (showLikesModal) {
        setShowLikesModal(false);
      }
    };

    if (showFullTitle || showLikesModal) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showFullTitle, showLikesModal]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (titleRef.current && !titleRef.current.contains(event.target)) {
        setShowFullTitle(false);
      }
    };

    if (showFullTitle) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFullTitle]);

  // Check if title is truncated
  useEffect(() => {
    const checkTruncation = () => {
      if (titleRef.current) {
        const { scrollWidth, clientWidth } = titleRef.current;
        setIsTruncated(scrollWidth > clientWidth);
      }
    };

    checkTruncation();
    // Also check on window resize
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [clipData.title]);

  const handleVisibilityToggle = async (newVisibility) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .from('clips')
        .update({ visibility: newVisibility })
        .eq('id', clipData.id)
        .single();

      if (error) throw error;

      // Update local state
      setClipData(prev => ({ ...prev, visibility: newVisibility }));
      
      // Handle different page scenarios
      if (router.pathname === '/discover' && newVisibility === 'private') {
        // Fade out and remove from discover page
        setTimeout(() => {
          setClipData(null);
        }, 300);
      } else if (typeof onClipUpdate === 'function') {
        // Update in profile page
        onClipUpdate(clipData.id, 'visibility', { visibility: newVisibility });
      }

    } catch (error) {
      console.error('Failed to update visibility:', error);
    } finally {
      setShowVisibilityModal(false);
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsUpdating(true);
      
      // First try the new API endpoint that handles both Cloudflare and database deletion
      const response = await fetch('/api/cloudflare/delete-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: clipData.id,
          videoUid: clipData.cloudflare_uid,
          userId: user?.id // For permission check
        }),
      });
      
      if (response.ok) {
        console.log('Video successfully deleted via API');
        // Call onClipUpdate after successful deletion
        onClipUpdate?.(clipData.id, 'delete');
        return;
      }
      
      console.log('API delete failed, falling back to database-only delete');
      
      // Fallback to direct database deletion if API call fails
      const { error } = await supabase
        .from('clips')
        .delete()
        .eq('id', clipData.id);

      if (error) throw error;

      // Call onClipUpdate after successful deletion
      onClipUpdate?.(clipData.id, 'delete');
      
    } catch (error) {
      console.error('Error deleting clip:', error);
    } finally {
      setIsUpdating(false);
      setShowDeleteModal(false);
    }
  };

  const handleTitleClick = () => {
    if (isTruncated) {
      setShowFullTitle(true);
    }
  };

  const handleCloseTitle = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFullTitle(false);
      setIsClosing(false);
    }, 200);
  };

  // If clip is deleted or made private (on discover page), don't render anything
  if (!clipData) return null;
  
  // Render processing state if clip is still processing or transitioning
  if (isProcessing || isTransitioning) {
    // Ensure we have valid status and progress information with defaults
    const status = clipData.status || 'processing';
    const statusLabel = isTransitioning ? 'Loading completed video...' : getStatusLabel(status);
    const progressPercentage = isTransitioning ? 100 : getProgressPercentage(clipData);
    const progressColor = isTransitioning ? '#7ed321' : getProgressColor(status);
    
    // Additional debug info in console
    console.log(`[ClipCard ${clipData.id}] Rendering processing card:`, {
      status,
      progressPercentage,
      processingDetails: clipData.processing_details
    });

    return (
      <div className={styles.cardContainer} ref={cardRef}>
        <div className={`${styles.card} ${styles.processingCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.userInfo}>
              <MdPerson />
              <span className={styles.username}>{clipData.username || 'Anonymous'}</span>
            </div>
            
            <div className={styles.titleContainer}>
              <h3 className={styles.title}>
                {clipData.title || 'Untitled Clip'}
              </h3>
            </div>
          </div>

          <div className={`${styles.videoContainer} ${styles.processingContainer}`}>
            <div className={styles.processingMessage}>
              <div className={styles.processingStatus}>{statusLabel}</div>
              {clipData.processing_details?.status_message && (
                <div className={styles.processingSubStatus}>
                  {clipData.processing_details.status_message}
                </div>
              )}
              <div className={styles.progressBarWrapper}>
                <div 
                  className={styles.progressBarFill} 
                  style={{ 
                    width: `${progressPercentage}%`,
                    backgroundColor: progressColor 
                  }} 
                />
              </div>
              <div className={styles.progressPercent}>{progressPercentage}%</div>
            </div>
          </div>

          <div className={styles.stats}>
            {isOwner && (
              <div className={styles.ownerActions}>
                <button
                  className={styles.actionButton}
                  onClick={() => setShowDeleteModal(true)}
                  disabled={isUpdating}
                  title="Cancel upload"
                >
                  <MdDelete />
                </button>
                <button
                  className={styles.actionButton}
                  onClick={refreshClipData}
                  disabled={isUpdating}
                  title="Refresh status"
                >
                  <MdSync />
                </button>
              </div>
            )}

            <div className={styles.gameTag}>
              {clipData.game || 'Processing...'}
            </div>
          </div>
        </div>
        
        <DeleteClipModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Cancel Upload"
          message="Are you sure you want to cancel this upload? This cannot be undone."
          confirmText="Cancel Upload"
        />
      </div>
    );
  }

  return (
    <div className={styles.cardContainer} ref={cardRef}>
      <div className={`${styles.card} ${isUpdating ? styles.updating : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.userInfo}>
            <MdPerson />
            <Link href={`/profile/${clipData.username}`} className={styles.usernameLink}>
              <span className={styles.username}>{clipData.username || 'Anonymous'}</span>
            </Link>
          </div>
          
          <div className={styles.titleContainer}>
            <h3 
              ref={titleRef}
              className={`${styles.title} ${isTruncated ? styles.clickable : ''}`}
              onClick={() => isTruncated && setShowTitleModal(true)}
            >
              {clipData.title || 'Untitled Clip'}
            </h3>
          </div>
        </div>

        <div className={styles.videoContainer}>
          <VideoPlayer clip={clipData} user={user} onLoadingChange={setIsLoading} isInClipCard={true} />
        </div>

        <div className={styles.stats}>
          {isOwner && (
            <div className={styles.ownerActions}>
              <button
                className={styles.actionButton}
                onClick={() => setShowVisibilityModal(true)}
                disabled={isUpdating}
                title={`Change visibility`}
              >
                {isPublic ? (
                  <MdPublic data-visibility="public" />
                ) : (
                  <MdLock data-visibility="private" />
                )}
              </button>
              <button
                className={styles.actionButton}
                onClick={() => setShowDeleteModal(true)}
                disabled={isUpdating}
                title="Delete clip"
              >
                <MdDelete />
              </button>
            </div>
          )}

          <div className={styles.actionGroup}>
            <div className={styles.likeContainer}>
              <button 
                className={`${styles.statButton} ${liked ? styles.liked : ''}`}
                onClick={handleLike}
                disabled={!user || isUpdatingLike}
              >
                {liked ? <MdFavorite /> : <MdFavoriteBorder />}
                <span>{likesCount}</span>
              </button>
              {likesCount > 0 && (
                <button 
                  className={styles.showLikesButton}
                  onClick={() => setShowLikesModal(true)}
                >
                  Show likes
                </button>
              )}
            </div>

            <button
              className={styles.actionButton}
              onClick={() => setShowShareModal(true)}
              title="Share clip"
            >
              <MdShare />
            </button>
          </div>

          <div className={styles.stat}>
            <MdVisibility />
            <span>{clipData.views_count || 0}</span>
          </div>

          {clipData.game && (
            <div className={styles.gameTag}>
              {clipData.game}
            </div>
          )}
        </div>

        <div className={styles.modalContainer}>
          <DeleteClipModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDelete}
          />
          <VisibilityModal
            isOpen={showVisibilityModal}
            onClose={() => setShowVisibilityModal(false)}
            isPublic={isPublic}
            onConfirm={handleVisibilityToggle}
            isUpdating={isUpdating}
          />
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            clipId={clipData.id}
          />
          <ExpandedTitleModal
            isOpen={showTitleModal}
            onClose={() => setShowTitleModal(false)}
            title={clipData.title || 'Untitled Clip'}
          />
        </div>
      </div>
      
      {showLikesModal && (
        <div className={styles.likesModalWrapper}>
          <div className={styles.likesModalOverlay} onClick={() => setShowLikesModal(false)}></div>
          <LikesModal
            isOpen={showLikesModal}
            onClose={() => setShowLikesModal(false)}
            likes={likesList}
            isLoadingLikes={isUpdatingLike}
          />
        </div>
      )}
    </div>
  );
};

export default ClipCard;