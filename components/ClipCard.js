import { useState, useCallback, useRef, useEffect } from 'react';
import { MdFavorite, MdFavoriteBorder, MdVisibility, MdPerson, MdExpandMore, 
  MdPublic, MdLock, MdDelete, MdShare, MdClose, MdSync, MdComment } from 'react-icons/md';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
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
import CommentsSection from './CommentsSection';
import CommentModal from './CommentModal';
import { fetchCommentsByClipId } from '../utils/supabase/comments';
import Link from 'next/link';

// Helper functions for processing status display
function getStatusLabel(status) {
  // If status is null or undefined, display "Ready"
  if (!status) return 'Ready';
  
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

function getProgressPercentage(clip) {
  // Safety check - if clip has no status or is missing, return 100% (complete)
  if (!clip || !clip.status) return 100;
  
  const { status } = clip;
  
  // Check if we have a progress value in processing_details
  if (clip.processing_details?.progress) {
    // For MP4 processing steps, ensure progress is always at least 65%
    if (['mp4_processing', 'waitformp4'].includes(status)) {
      return Math.max(65, clip.processing_details.progress);
    }
    
    // For other statuses, use the provided progress value
    return clip.processing_details.progress;
  }
  
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

function getProgressColor(status) {
  // Default for undefined status
  if (!status) return '#00b74a'; // Bright Green for completed/default
  
  // Map status to processing stage
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
  
  // Add state for heart animation
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState([]);
  
  // Add state for comments 
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Check if the clip is still processing
  // Add safety check - if status is missing, assume clip is complete
  const clipStatus = clipData.status || 'complete';
  const isProcessing = ['uploading', 'queue', 'queued', 'processing', 'ready_to_stream', 
    'stream_ready', 'waitformp4', 'mp4_processing', 'mp4_downloading', 'mp4downloading', 
    'r2_uploading'].includes(clipStatus);
  
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
            console.log(`[ClipCard ${clipData.id}] Clip updated:`, payload.new);
            
            // If transitioning to complete, add a smooth animation
            if (payload.new.status === 'complete' && clipData.status !== 'complete') {
              console.log(`[ClipCard ${clipData.id}] Video complete! Transitioning to player`);
              setIsTransitioning(true);
              setTimeout(() => refreshClipData(), 500); // Give DB time to finalize
            } else {
              // For all other updates, just update the state directly
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

  // Fetch comment count when ClipCard mounts or when comments are shown/hidden
  useEffect(() => {
    const getCommentCount = async () => {
      if (!clipData?.id || !supabase) return;
      
      try {
        setIsLoadingComments(true);
        const result = await fetchCommentsByClipId(clipData.id, 1, 0);
        setCommentsCount(result.count || 0);
      } catch (error) {
        console.error('Error fetching comment count:', error);
      } finally {
        setIsLoadingComments(false);
      }
    };
    
    getCommentCount();
  }, [clipData?.id, supabase, showCommentModal]);

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

  // Enhanced like handler with multiple floating hearts animation
  const handleLikeWithAnimation = () => {
    // Only animate if the user is logged in and not already liking/unliking
    if (!user || isUpdatingLike) return;
    
    // If not already liked, show the animation
    if (!liked) {
      setIsHeartAnimating(true);
      
      // Create 3-5 random floating hearts
      const numHearts = Math.floor(Math.random() * 3) + 3; // 3-5 hearts
      const newHearts = [];
      
      for (let i = 0; i < numHearts; i++) {
        // Create random positions and delays for each heart
        newHearts.push({
          id: `heart-${Date.now()}-${i}`,
          left: Math.random() * 40 - 20, // -20px to +20px from center
          delay: Math.random() * 0.3, // 0 to 0.3s delay
          scale: 0.8 + Math.random() * 0.4, // 0.8 to 1.2 scale
          rotation: (Math.random() * 40) - 20 // -20 to +20 degrees
        });
      }
      
      setFloatingHearts(newHearts);
      
      // Clear animation state after animation completes
      setTimeout(() => {
        setIsHeartAnimating(false);
        setFloatingHearts([]);
      }, 1200);
    }
    
    // Call the original like handler
    handleLike();
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
                className={`${styles.statButton} ${liked ? styles.liked : ''} ${isHeartAnimating ? styles.heartAnimating : ''}`}
                onClick={handleLikeWithAnimation}
                disabled={!user || isUpdatingLike}
                aria-label={liked ? "Unlike" : "Like"}
              >
                {liked ? <FaHeart className={styles.likeIcon} /> : <FaRegHeart />}
                <span>{likesCount}</span>
              </button>
              
              {/* Multiple floating hearts */}
              {floatingHearts.length > 0 && (
                <div className={styles.floatingHeartsContainer}>
                  {floatingHearts.map(heart => (
                    <FaHeart 
                      key={heart.id}
                      className={styles.floatingHeart}
                      style={{
                        left: `calc(50% + ${heart.left}px)`,
                        animationDelay: `${heart.delay}s`,
                        transform: `scale(${heart.scale}) rotate(${heart.rotation}deg)`
                      }}
                    />
                  ))}
                </div>
              )}
              
              {likesCount > 0 && (
                <button 
                  className={styles.showLikesButton}
                  onClick={() => setShowLikesModal(true)}
                >
                  View {likesCount > 1 ? 'likes' : 'like'}
                </button>
              )}
            </div>

            <button
              className={`${styles.actionButton}`}
              onClick={() => setShowCommentModal(true)}
              title="Show comments"
            >
              <MdComment />
              {commentsCount > 0 && (
                <span className={styles.inlineCount}>{commentsCount}</span>
              )}
            </button>
            
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
        
        {/* Add CommentModal component */}
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          clipId={clipData.id}
          clipTitle={clipData.title || 'Untitled Clip'}
        />

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