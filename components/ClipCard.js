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

/**
 * Status order hierarchy to prevent regression
 * Higher number = further along in the process
 * This ensures statuses only move forward in the processing flow
 */
const STATUS_ORDER = {
  'uploading': 10, 
  'queued': 20,
  'processing': 30,
  'stream_ready': 40,
  'waitformp4': 50,
  'mp4downloading': 60,
  'mp4_processing': 70,
  'r2_uploading': 80,
  'complete': 100
};

/**
 * Helper function to check if a status change is a regression
 * @param {string} oldStatus - The previous status
 * @param {string} newStatus - The new status to transition to
 * @returns {boolean} - True if the change would be a regression
 */
function isStatusRegression(oldStatus, newStatus) {
  // If we don't know either status, assume it's not a regression
  if (!STATUS_ORDER[oldStatus] || !STATUS_ORDER[newStatus]) return false;
  
  // It's a regression if the new status has a lower order value than the old status
  return STATUS_ORDER[newStatus] < STATUS_ORDER[oldStatus];
}

/**
 * Provides user-friendly status labels for display
 * @param {string} status - The current processing status
 * @returns {string} - Human-readable status label
 */
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

/**
 * Calculates the progress percentage based on status and processing details
 * Prioritizes actual progress values from processing_details when available
 * @param {Object} clip - The clip object containing status and processing_details
 * @returns {number} - Progress percentage (0-100)
 */
function getProgressPercentage(clip) {
  // Safety check - if clip has no status or is missing, return 100% (complete)
  if (!clip || !clip.status) return 100;
  
  const { status } = clip;
  
  // First priority: use progress from processing_details if available
  if (clip.processing_details?.progress !== undefined && 
      typeof clip.processing_details.progress === 'number') {
    return clip.processing_details.progress;
  }
  
  // Second priority: use specific processing stage percentages
  if (clip.processing_details) {
    // For MP4 processing steps, check mp4_percent_complete
    if (['mp4_processing', 'waitformp4'].includes(status) && 
        clip.processing_details.mp4_percent_complete !== undefined) {
      return Math.max(70, clip.processing_details.mp4_percent_complete);
    }
    
    // For R2 upload, check r2_upload_progress
    if (status === 'r2_uploading' && 
        clip.processing_details.r2_upload_progress !== undefined) {
      return clip.processing_details.r2_upload_progress;
    }
    
    // For Cloudflare processing, scale their percentage to our range
    if (status === 'processing' && 
        clip.processing_details.cloudflare_status === 'inprogress' && 
        typeof clip.processing_details.progress === 'number') {
      // Scale Cloudflare progress (0-100) to our range (30-60)
      return 30 + (clip.processing_details.progress * 0.3);
    }
  }
  
  // Third priority: fall back to default percentages based on status
  switch (status) {
    case 'uploading': return 15;
    case 'queued': return 30;
    case 'processing': return 50;
    case 'stream_ready': return 65;
    case 'mp4_processing': return 70; 
    case 'waitformp4': return 80;
    case 'mp4downloading': return 90;
    case 'r2_uploading': return 95;
    default: return 50;
  }
}

/**
 * Gets the appropriate color for the progress bar based on status
 * @param {string} status - The current processing status
 * @returns {string} - Color code for the progress bar
 */
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
    
    console.log(`[ClipCard] Refreshing clip data for ${clipData.id}`);
    setIsTransitioning(true); // Set transitioning state to true during refresh
    
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('id', clipData.id)
        .single();
        
      if (error) {
        console.error('[ClipCard] Error refreshing clip data:', error);
        setIsTransitioning(false);
        return;
      }
      
      if (data) {
        console.log('[ClipCard] Clip data refreshed:', data);
        
        // Check for status regression and handle it
        if (clipData.status && data.status && isStatusRegression(clipData.status, data.status)) {
          console.log(`[ClipCard] Preventing status regression during refresh: ${clipData.status} -> ${data.status}`);
          
          // Create a merged version that keeps current status but takes other updates
          const mergedData = {
            ...data,
            status: clipData.status,
            processing_details: {
              ...(data.processing_details || {}),
              status_message: `Continuing ${clipData.status} processing (prevented regression to ${data.status})`
            }
          };
          
          // If transitioning from processing to complete, add a small delay
          if (mergedData.status === 'complete' && isProcessing) {
            console.log('[ClipCard] Transitioning to complete with delay');
            // Keep transitioning state true for a bit longer
            setTimeout(() => {
              setClipData(mergedData);
              // Only turn off transitioning after another delay to ensure player has time to load
              setTimeout(() => setIsTransitioning(false), 1000);
            }, 500);
          } else {
            setClipData(mergedData);
            setIsTransitioning(false);
          }
        } else {
          // Normal update without regression
          // If transitioning from processing to complete, add a small delay
          if (data.status === 'complete' && isProcessing) {
            console.log('[ClipCard] Transitioning to complete with delay');
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
        }
        
        // If clip is now complete and there's an update callback, call it
        if (data.status === 'complete' && typeof onClipUpdate === 'function') {
          onClipUpdate(clipData.id, 'status', data);
        }
      }
    } catch (err) {
      console.error('[ClipCard] Failed to refresh clip data:', err);
      setIsTransitioning(false);
    }
  }, [clipData.id, clipData.status, supabase, onClipUpdate, isProcessing]);

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
            console.log('[ClipCard] Clip update received:', payload.new);
            
            // Check for status regression and handle it
            if (payload.old.status && payload.new.status && 
                isStatusRegression(payload.old.status, payload.new.status)) {
              
              console.log(`[ClipCard] Preventing status regression: ${payload.old.status} -> ${payload.new.status}`);
              
              // Keep the old status but update other fields
              setClipData(prev => ({
                ...prev, 
                ...payload.new,
                status: prev.status, // Keep the previous status to prevent regression
                processing_details: {
                  ...(payload.new.processing_details || {}),
                  status_message: `Continuing ${prev.status} processing (prevented regression from ${payload.new.status})` 
                }
              }));
            }
            // Special case for mp4_processing/waitformp4 cycling which might appear as regression but is normal
            // These two states can alternate legitimately during MP4 processing
            else if (payload.old.status === 'mp4_processing' && payload.new.status === 'waitformp4') {
              // Merge the two states - keep mp4_processing status but update other fields
              console.log('[ClipCard] Handling mp4_processing to waitformp4 transition');
              setClipData(prev => ({
                ...prev, 
                ...payload.new,
                status: 'mp4_processing', // Keep the previous status for visual consistency
                processing_details: {
                  ...(payload.new.processing_details || {}),
                  status_message: 'Continuing MP4 processing...'
                }
              }));
            } else if (payload.old.status === 'waitformp4' && payload.new.status === 'mp4_processing') {
              // Similar for the opposite direction
              console.log('[ClipCard] Handling waitformp4 to mp4_processing transition');
              setClipData(prev => ({
                ...prev, 
                ...payload.new,
                status: 'waitformp4', // Keep the previous status for visual consistency
                processing_details: {
                  ...(payload.new.processing_details || {}),
                  status_message: 'Continuing MP4 processing...'
                }
              }));
            } else if (payload.new.status === 'complete' && payload.old.status !== 'complete') {
              // If status has changed to complete, set transitioning state and refresh after a delay
              console.log('[ClipCard] Transitioning to complete status...');
              setIsTransitioning(true);
              setTimeout(() => refreshClipData(), 500); // Give DB time to finalize
            } else {
              // Normal update for other status changes
              console.log(`[ClipCard] Normal status update: ${payload.old.status || 'none'} -> ${payload.new.status}`);
              setClipData(prev => ({...prev, ...payload.new}));
            }
            
            // If clip is now complete, call onClipUpdate if provided
            if (payload.new.status === 'complete' && typeof onClipUpdate === 'function') {
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
    
    // Get additional details if available
    let detailText = '';
    if (clipData.processing_details) {
      // Priority 1: Use explicitly set status message if available
      if (clipData.processing_details.status_message) {
        detailText = clipData.processing_details.status_message;
      }
      // Priority 2: Show MP4 processing percentage if available
      else if (['waitformp4', 'mp4_processing'].includes(status) && 
               clipData.processing_details.mp4_percent_complete !== undefined) {
        detailText = `MP4 creation: ${Math.round(clipData.processing_details.mp4_percent_complete)}% complete`;
      }
      // Priority 3: Show R2 upload details if available
      else if (status === 'r2_uploading' && clipData.processing_details.r2_upload_progress !== undefined) {
        detailText = `Upload progress: ${Math.round(clipData.processing_details.r2_upload_progress)}%`;
      }
      // Priority 4: Show Cloudflare status information if available
      else if (clipData.processing_details.cloudflare_status) {
        detailText = `Cloudflare: ${clipData.processing_details.cloudflare_status}`;
        if (clipData.processing_details.processing_step) {
          detailText += ` (${clipData.processing_details.processing_step})`;
        }
        if (clipData.processing_details.progress !== undefined) {
          detailText += ` - ${Math.round(clipData.processing_details.progress)}%`;
        }
      }
    }

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
              {detailText && (
                <div className={styles.processingDetail}>{detailText}</div>
              )}
              <div className={styles.progressBarWrapper}>
                <div 
                  className={styles.progressBarFill} 
                  style={{ 
                    width: `${Math.min(100, progressPercentage)}%`, // Ensure we don't exceed 100%
                    backgroundColor: progressColor 
                  }} 
                />
              </div>
              <div className={styles.progressPercent}>{Math.round(progressPercentage)}%</div>
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