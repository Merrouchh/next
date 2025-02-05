import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  MdPerson, 
  MdGames, 
  MdFavorite, 
  MdFavoriteBorder, 
  MdVisibility,
  MdDelete,
  MdPublic,
  MdLock,
  MdShare,
  MdContentCopy
} from 'react-icons/md';
import styles from '../styles/VideoPlayer.module.css';
import clipStyles from '../styles/ClipCard.module.css';
import { MediaPlayer, MediaProvider, Poster } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import { checkLikeStatus } from '../utils/supabase/clips';
import { useVideo } from '../context/VideoContext';
import LikesModal from './LikesModal';
import { trackView } from '@/utils/viewTracking';
import { useLikes } from '../hooks/useLikes';
import { createClient } from '../utils/supabase/component';
import DeleteClipModal from './DeleteClipModal';
import { isHLSProvider } from '@vidstack/react';

const VideoPlayer = ({ 
  clip,
  user,
  onPlay,
  showActions = true,
  showHeader = true,
  isOwner = false,
  onClipDelete,
  onClipUpdate
}) => {
  const router = useRouter();
  const { currentPlayingId, setCurrentPlayingId } = useVideo();
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [canPlay, setCanPlay] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const likesButtonRef = useRef(null);
  const [modalTriggerRect, setModalTriggerRect] = useState(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCopyTooltip, setShowCopyTooltip] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(null);
  const [isHLS, setIsHLS] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const lastSeekTime = useRef(0);

  const {
    liked,
    setLiked,
    likesCount,
    isUpdatingLike,
    likesList,
    handleLike,
    fetchLikes
  } = useLikes(false, clip.likes_count || 0);

  // Construct URLs
  const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}`;
  const thumbnailUrl = clip.thumbnail_path ? 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}` 
    : null;

  // Basic play handler
  const handlePlay = () => {
    if (playerRef.current && canPlay) {
      setIsPlaying(true);
      setHasStartedPlaying(true);
      setCurrentPlayingId(clip.id);
      onPlay?.();
    }
  };

  // Pause other videos when this one starts playing
  useEffect(() => {
    if (currentPlayingId && currentPlayingId !== clip.id && isPlaying) {
      playerRef.current?.pause();
    }
  }, [currentPlayingId, clip.id, isPlaying]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (playerRef.current) {
        try {
          const player = playerRef.current;
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
          }
          player.pause();
        } catch (error) {
          console.error('Error cleaning up video player:', error);
        }
      }
    };
  }, []);

  // Handle page transitions
  useEffect(() => {
    const handleRouteChange = async () => {
      if (playerRef.current) {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          }
          playerRef.current.pause();
        } catch (error) {
          console.error('Error during route change:', error);
        }
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router]);

  // Check initial like status
  useEffect(() => {
    const checkInitialLikeStatus = async () => {
      if (!user || !clip) return;

      try {
        const isLiked = await checkLikeStatus(clip.id, user.id);
        setLiked(isLiked);
        await fetchLikes(clip.id);
      } catch (error) {
        console.error('Failed to check initial like status:', error);
      }
    };

    checkInitialLikeStatus();
  }, [clip?.id, user?.id]);

  const handleLikeClick = async () => {
    if (!user) {
      // Optional: Show login prompt
      return;
    }

    const success = await handleLike(clip.id, user.id);
    if (success && showLikesModal) {
      await fetchLikes(clip.id);
    }
  };

  // Handle modal open
  const handleModalOpen = useCallback(async () => {
    if (likesCount > 0 && likesButtonRef.current) {
      // Get the button's position
      const rect = likesButtonRef.current.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      setModalTriggerRect({
        top: rect.top + scrollY,
        left: rect.left + scrollX,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom + scrollY,
        right: rect.right + scrollX
      });

      // Fetch fresh likes data when opening modal
      await fetchLikes(clip.id);
      setShowLikesModal(true);
    }
  }, [clip.id, likesCount, fetchLikes]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowLikesModal(false);
    setModalTriggerRect(null);
  }, []);

  // Reset modal state when clip changes
  useEffect(() => {
    return () => {
      setShowLikesModal(false);
      setModalTriggerRect(null);
    };
  }, [clip.id]);

  const handleDelete = async () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('clips')
        .delete()
        .eq('id', clip.id);

      if (error) throw error;
      onClipDelete?.(clip.id);
    } catch (error) {
      console.error('Error deleting clip:', error);
      alert('Failed to delete clip');
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleVisibilityToggle = async () => {
    const newVisibility = clip.visibility === 'public' ? 'private' : 'public';
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clips')
        .update({ visibility: newVisibility })
        .eq('id', clip.id)
        .select()
        .single();

      if (error) throw error;
      onClipUpdate?.(data);
    } catch (error) {
      console.error('Error updating clip visibility:', error);
      alert('Failed to update clip visibility');
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/clip/${clip.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: clip.title,
          text: `Check out this clip by ${clip.username}`,
          url: shareUrl
        });
      } else {
        // Fallback to copying the link
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      await navigator.clipboard.writeText(clipUrl);
      setShowCopyTooltip(true);
      setTimeout(() => setShowCopyTooltip(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy clip link');
    }
  };

  const handleProviderChange = useCallback((provider) => {
    if (isHLSProvider(provider)) {
      setIsHLS(true);
      provider.config = {
        enableWorker: true,
        startLevel: -1, // Auto quality
        capLevelToPlayerSize: true,
        debug: false,
        // Basic buffering settings
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Basic error recovery
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
      };
    }
  }, []);

  const handleHlsManifestLoaded = useCallback((event) => {
    if (event.detail?.levels?.length > 0) {
      console.log('Available quality levels:', event.detail.levels);
    }
  }, []);

  const handleHlsLevelSwitched = useCallback((event) => {
    if (event?.detail?.level !== undefined) {
      setCurrentQuality(event.detail.level);
    }
  }, []);

  const handleHlsError = useCallback((e) => {
    console.error('HLS Error:', e);
    
    if (e?.detail) {
      const { details, fatal } = e.detail;
      
      if (fatal) {
        setError('Playback error: ' + (details || 'Unknown error'));
        if (playerRef.current) {
          playerRef.current.load();
        }
      }
    }
  }, []);

  // Add back view tracking
  useEffect(() => {
    let timeoutId;
    if (isPlaying && !hasTrackedView) {
      timeoutId = setTimeout(() => {
        trackView(clip.id, user?.id).then(() => {
          setHasTrackedView(true);
        });
      }, 5000); // Track view after 5 seconds of playback
    }
    return () => clearTimeout(timeoutId);
  }, [isPlaying, hasTrackedView, clip.id, user?.id]);

  // Add seeking handlers
  const handleSeeking = useCallback(() => {
    setIsSeeking(true);
    const now = Date.now();
    lastSeekTime.current = now;
  }, []);

  const handleSeeked = useCallback(() => {
    setIsSeeking(false);
    // Add a small delay before allowing new seeks
    setTimeout(() => {
      if (Date.now() - lastSeekTime.current >= 500) {
        setIsBuffering(false);
      }
    }, 100);
  }, []);

  // Modify the buffering handlers to be more precise
  const handleWaiting = useCallback(() => {
    // Only show buffering if we're actually waiting for data
    if (playerRef.current?.readyState < 3) {
      setIsBuffering(true);
      setCanPlay(false);
    }
  }, []);

  const handleCanPlay = useCallback(() => {
    // Clear buffering state when we have enough data
    setIsBuffering(false);
    setCanPlay(true);
  }, []);

  return (
    <div className={clipStyles.clipContainer}>
      {showHeader && (
        <div className={clipStyles.clipHeader}>
          <button 
            onClick={() => router.push(`/profile/${clip.username}`)}
            className={clipStyles.userLink}
          >
            <MdPerson />
            <span>{clip.username}</span>
          </button>
          {clip.game && (
            <span className={clipStyles.gameTag}>
              <MdGames />
              {clip.game}
            </span>
          )}
        </div>
      )}

      {clip.title && <h3 className={clipStyles.clipTitle}>{clip.title}</h3>}

      <div className={styles.videoPlayerWrapper} data-playing={isPlaying}>
        <MediaPlayer
          ref={playerRef}
          load="visible"
          title={clip.title}
          src={videoUrl}
          aspectRatio={16/9}
          playsInline
          autoPlay={false}
          style={{ width: '100%', height: '100%' }}
          data-screen-orientation="manual"
          data-view-type="video"
          onPlay={handlePlay}
          onPause={() => {
            setIsPlaying(false);
            if (currentPlayingId === clip.id) {
              setCurrentPlayingId(null);
            }
          }}
          onCanPlay={handleCanPlay}
          onWaiting={handleWaiting}
          onSeeking={handleSeeking}
          onSeeked={handleSeeked}
          onError={(e) => {
            console.error('Video player error:', e);
            setError('Failed to load video');
            setCanPlay(false);
            // Try to recover from error
            if (playerRef.current) {
              playerRef.current.load();
            }
          }}
          onProviderChange={handleProviderChange}
          onHlsManifestLoaded={handleHlsManifestLoaded}
          onHlsLevelSwitched={handleHlsLevelSwitched}
          onHlsError={handleHlsError}
        >
          <MediaProvider>
            <source 
              src={videoUrl}
              type={clip.file_path.endsWith('.m3u8') ? "application/x-mpegURL" : "video/mp4"}
            />
            {thumbnailUrl && (
              <div className={styles.posterWrapper}>
                <Poster
                  className="vds-poster"
                  src={thumbnailUrl}
                  alt={clip.title || 'Video thumbnail'}
                  data-visible={!hasStartedPlaying}
                />
              </div>
            )}
          </MediaProvider>
          <DefaultVideoLayout icons={defaultLayoutIcons} />
          
          {/* Update quality indicator with safer check */}
          {isHLS && currentQuality !== null && currentQuality !== undefined && (
            <div className={styles.qualityIndicator}>
              {currentQuality === -1 ? 'Auto' : '1080p'}
            </div>
          )}

          {/* Only show buffering indicator when actually buffering */}
          {isBuffering && !isPlaying && (
            <div className={styles.bufferingOverlay}>
              <div className={styles.bufferingSpinner}></div>
            </div>
          )}

          {error && (
            <div className={styles.errorOverlay}>
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}
        </MediaPlayer>
      </div>

      {showActions && (
        <div className={clipStyles.clipStats}>
          <div className={clipStyles.statsContainer}>
            <div className={clipStyles.actionButtons}>
              {isOwner && (
                <div className={clipStyles.ownerActions}>
                  <button
                    onClick={handleDelete}
                    className={clipStyles.actionButton}
                    title="Delete clip"
                  >
                    <MdDelete />
                  </button>
                  <button
                    onClick={handleVisibilityToggle}
                    className={clipStyles.actionButton}
                    title={`Make ${clip.visibility === 'public' ? 'private' : 'public'}`}
                  >
                    {clip.visibility === 'public' ? <MdPublic /> : <MdLock />}
                  </button>
                </div>
              )}
              <button
                onClick={handleShare}
                className={clipStyles.actionButton}
                title="Share clip"
              >
                <MdShare />
              </button>
              <div className={clipStyles.copyIdWrapper}>
                <button
                  onClick={handleCopyLink}
                  className={clipStyles.actionButton}
                  title="Copy clip link"
                >
                  <MdContentCopy />
                </button>
                {showCopyTooltip && (
                  <div className={clipStyles.copyTooltip}>
                    Link copied!
                  </div>
                )}
              </div>
            </div>
            <div className={clipStyles.viewCount}>
              <MdVisibility />
              <span>{clip.views_count || 0}</span>
            </div>
            <div className={clipStyles.likeContainer}>
              <button
                onClick={handleLikeClick}
                className={`${clipStyles.likeButton} ${liked ? clipStyles.liked : ''}`}
                disabled={!user || isUpdatingLike}
                title={user ? (liked ? 'Unlike' : 'Like') : 'Sign in to like'}
              >
                {liked ? <MdFavorite /> : <MdFavoriteBorder />}
              </button>
              <button 
                ref={likesButtonRef}
                onClick={handleModalOpen}
                className={clipStyles.likesCount}
                style={{ 
                  cursor: likesCount > 0 ? 'pointer' : 'default',
                  border: 'none',
                  background: 'none',
                  padding: 0
                }}
                disabled={likesCount === 0}
                title={likesCount > 0 ? "Click to see who liked this" : "No likes yet"}
              >
                {likesCount}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteClipModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
      />

      <LikesModal
        isOpen={showLikesModal}
        onClose={handleModalClose}
        likes={likesList}
        triggerRect={modalTriggerRect}
      />
    </div>
  );
};

export default VideoPlayer; 