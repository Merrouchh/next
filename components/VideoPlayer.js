import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  MdContentCopy,
  MdPlayArrow
} from 'react-icons/md';
import styles from '../styles/VideoPlayer.module.css';
import clipStyles from '../styles/ClipCard.module.css';
import { MediaPlayer, MediaProvider, Poster } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { useVideo } from '../contexts/VideoContext';
import LikesModal from './LikesModal';
import { trackView } from '@/utils/viewTracking';
import { useLikes } from '../hooks/useLikes';
import DeleteClipModal from './DeleteClipModal';
import Hls from 'hls.js';
import { toast } from 'react-hot-toast';

// Add this at the top of your component
const isBrowser = typeof window !== 'undefined';

// Create a regular component first
const VideoPlayer = ({
  clip,
  user,
  _onPlayerInit,
  onClipUpdate,
  showActions = true,
  showHeader = true,
  onClipDelete,
  isOwner = false,
}) => {
  // Core player state
  const player = useRef(null);
  const router = useRouter();
  const { currentPlayingId, setCurrentPlayingId } = useVideo();
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [error, setError] = useState(null);
  const [hlsError, setHlsError] = useState(null);

  // Lazy loading state
  const [shouldLoad, setShouldLoad] = useState(false);
  const observerRef = useRef(null);

  // Memoize video URL to prevent multiple fetches
  const videoUrl = useMemo(() => 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}`,
    [clip.file_path]
  );

  const thumbnailUrl = useMemo(() => 
    clip.thumbnail_path ? 
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}` 
      : null,
    [clip.thumbnail_path]
  );

  // Likes handling
  const {
    liked,
    likesCount,
    isUpdatingLike,
    likesList,
    handleLike,
    fetchLikes
  } = useLikes(clip.id, clip.likes_count || 0, user);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const likesButtonRef = useRef(null);
  const [modalTriggerRect, setModalTriggerRect] = useState(null);

  // UI state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCopyTooltip, setShowCopyTooltip] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const hlsRef = useRef(null);
  const bufferingTimeoutRef = useRef(null);

  // Use it in your memoized values that depend on window
  const origin = useMemo(() => 
    isBrowser ? window.location.origin : '',
    []
  );

  // Add these state variables at the top of your component
  const [isPlayRequested, setIsPlayRequested] = useState(false);
  const playRequestRef = useRef(null);

  // Action handlers
  const handleVisibilityToggle = useCallback(async () => {
    if (!isOwner) return;
    
    try {
      const newVisibility = clip.visibility === 'public' ? 'private' : 'public';
      
      // Call the update handler with the updated clip
      await onClipUpdate?.({
        ...clip,
        visibility: newVisibility
      });
      
      toast.success(`Clip is now ${newVisibility}`);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update clip visibility');
    }
  }, [clip, isOwner, onClipUpdate]);

  const handleLikeClick = useCallback(async () => {
    if (!user) return;
    
    try {
      const success = await handleLike();
      if (success && showLikesModal) {
        await fetchLikes();
      }
    } catch (error) {
      console.error('Error handling like:', error);
      toast.error('Failed to update like');
    }
  }, [user, handleLike, showLikesModal, fetchLikes]);

  const handleLikesModalOpen = useCallback(async () => {
    if (likesCount > 0 && likesButtonRef.current) {
      const rect = likesButtonRef.current.getBoundingClientRect();
      setModalTriggerRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom + window.scrollY,
        right: rect.right + window.scrollX
      });
      
      setShowLikesModal(true);
      await fetchLikes();
    }
  }, [likesCount, fetchLikes]);

  const handleShare = useCallback(async () => {
    const shareUrl = `${origin}/clip/${clip.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: clip.title,
          text: `Check out this clip by ${clip.username}`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share clip');
    }
  }, [clip.id, clip.title, clip.username, origin]);

  const handleCopyLink = useCallback(async () => {
    try {
      const clipUrl = `${origin}/clip/${clip.id}`;
      await navigator.clipboard.writeText(clipUrl);
      setShowCopyTooltip(true);
      setTimeout(() => setShowCopyTooltip(false), 2000);
      toast.success('Link copied!');
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error('Failed to copy link');
    }
  }, [clip.id, origin]);

  // Video event handlers
  const handleCanPlay = useCallback(() => {
    setCanPlay(true);
    setIsBuffering(false);
  }, []);

  const handleWaiting = () => {
    // Clear any existing timeout
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
    }
    
    // Set a timeout before showing buffering indicator to prevent flashing
    bufferingTimeoutRef.current = setTimeout(() => {
      setIsBuffering(true);
    }, 500);
  };

  const handlePlaying = () => {
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
    }
    setIsBuffering(false);
  };

  const handleError = useCallback(() => {
    setError('Failed to load video');
    setCanPlay(false);
  }, []);

  // Intersection Observer setup
  useEffect(() => {
    if (!isBrowser) return;
    
    const options = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observerRef.current?.disconnect();
        }
      });
    }, options);

    if (player.current) {
      observerRef.current.observe(player.current);
    }

    return () => observerRef.current?.disconnect();
  }, []);

  // View tracking
  useEffect(() => {
    if (!isBrowser) return;
    
    let timeoutId;
    if (isPlaying && !hasTrackedView) {
      timeoutId = setTimeout(() => {
        trackView(clip.id, user?.id).then(() => setHasTrackedView(true));
      }, 5000);
    }
    return () => clearTimeout(timeoutId);
  }, [isPlaying, hasTrackedView, clip.id, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
      }
    };
  }, []);

  // First, update the useEffect to pause when currentPlayingId changes
  useEffect(() => {
    if (!isBrowser) return;
    
    // If another video starts playing (currentPlayingId changes to a different id)
    // and this video is currently playing, pause it
    if (currentPlayingId && currentPlayingId !== clip.id && isPlaying) {
      player.current?.pause().catch(err => {
        console.error('Error pausing video:', err);
      });
    }
  }, [currentPlayingId, clip.id, isPlaying]);

  // Cleanup HLS instance on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Add a new effect to handle auto-play
  useEffect(() => {
    if (!isBrowser) return;
    
    if (shouldLoad && canPlay && !hasStartedPlaying) {
      player.current?.play().catch(err => {
        console.error('Auto-play failed:', err);
      });
    }
  }, [shouldLoad, canPlay, hasStartedPlaying]);

  useEffect(() => {
    if (!isBrowser) return;
    
    if (!clip?.file_path) return;

    // Check if it's an MP4 or HLS video
    const isHLS = clip.file_path.endsWith('.m3u8');
    const videoElement = player.current?.querySelector('video');
    
    if (!videoElement) return;

    // Prevent multiple loads of the same video
    if (videoElement.src === videoUrl) return;

    // Set crossOrigin before setting src
    videoElement.crossOrigin = 'anonymous';

    // Configure video element for better buffering
    videoElement.preload = "metadata";  // Start with metadata only
    videoElement.addEventListener('canplaythrough', () => {
      setIsBuffering(false);
    });

    // If it's MP4, configure for better buffering
    if (!isHLS) {
      videoElement.src = videoUrl;
      return;
    }

    const initHls = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: process.env.NODE_ENV === 'development',
          
          // Optimize for small segments
          maxBufferSize: 200 * 1000 * 1000, // Increase to 200MB to store more segments
          maxBufferLength: 90, // Buffer up to 90 seconds
          maxMaxBufferLength: 120, // Allow up to 120 seconds in special cases
          
          // Aggressive buffering strategy
          highBufferWatchdogPeriod: 10,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 5,
          
          // Preload aggressively
          startFragPrefetch: true,
          lowLatencyMode: false,
          backBufferLength: 90, // Keep 90 seconds of back buffer
          
          // Bandwidth and quality settings
          abrEwmaDefaultEstimate: 5000000, // Start with 5 Mbps estimate
          abrEwmaFastLive: 2, // Faster quality switching
          abrEwmaSlowLive: 5,
          
          // Segment loading optimizations
          maxFragLookUpTolerance: 0.5,
          maxLoadingDelay: 1,
          maxStarvationDelay: 8,
          startLevel: -1,
          autoStartLoad: true,
          
          // Advanced loading policies for small segments
          fragLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 5000,
              maxLoadTimeMs: 60000,
              timeoutRetry: {
                maxNumRetry: 8,
                retryDelayMs: 1000,
                maxRetryDelayMs: 8000
              },
              errorRetry: {
                maxNumRetry: 8,
                retryDelayMs: 1000,
                maxRetryDelayMs: 8000
              }
            }
          },
          
          // Batch loading for small segments
          maxBufferHole: 0.5,
          maxSeekHole: 2,
          appendErrorMaxRetry: 5,
          
          // Enable better segment merging
          stretchShortVideoTrack: true,
          maxAudioFramesDrift: 1,
          enableSoftwareAES: true,
          
          // Memory management
          enableWorker: true,
          testBandwidth: true,
          progressive: true
        });

        // Add more comprehensive event handling
        hls.on(Hls.Events.FRAG_LOADING, () => {
          setIsBuffering(true);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          setIsBuffering(false);
          // Try to preload next fragment
          if (data.frag.sn !== undefined) {
            hls.loadFragment(data.frag.sn + 1);
          }
        });

        hls.on(Hls.Events.BUFFER_APPENDED, () => {
          setIsBuffering(false);
        });

        hls.on(Hls.Events.BUFFER_APPENDING, () => {
          setIsBuffering(true);
        });

        // Handle quality level changes
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          setIsBuffering(false);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          setIsBuffering(false);
        });

        // Enhanced error handling
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Network error, retrying...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Media error, recovering...');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error, destroying...');
                hls.destroy();
                break;
            }
          } else {
            // Handle non-fatal errors
            console.warn('Non-fatal error:', data);
            if (data.type === Hls.ErrorTypes.BUFFER_STALLED_ERROR) {
              hls.trigger(Hls.Events.BUFFER_FLUSHING);
            }
          }
        });

        hlsRef.current = hls;
        return hls;
      }
      return null;
    };

    const hls = initHls();
    
    if (hls && videoElement) {
      hls.loadSource(videoUrl);
      hls.attachMedia(videoElement);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [clip?.file_path, videoUrl]);

  // Update these functions to use Vidstack's API
  const handlePlayRequest = useCallback(async () => {
    if (playRequestRef.current) {
      clearTimeout(playRequestRef.current);
    }

    setIsPlayRequested(true);

    try {
      await new Promise(resolve => {
        playRequestRef.current = setTimeout(resolve, 50);
      });

      if (isPlayRequested && player.current) {
        // Use Vidstack's API instead of querySelector
        const mediaPlayer = player.current;
        if (!mediaPlayer.playing) {
          await mediaPlayer.play();
        }
      }
    } catch (error) {
      console.error('Play error:', error);
      setIsPlayRequested(false);
    }
  }, [isPlayRequested]);

  const handlePauseRequest = useCallback(() => {
    setIsPlayRequested(false);
    if (player.current) {
      // Use Vidstack's API instead of querySelector
      const mediaPlayer = player.current;
      if (mediaPlayer.playing) {
        mediaPlayer.pause();
      }
    }
  }, []);

  // Add this useEffect for cleanup
  useEffect(() => {
    return () => {
      if (playRequestRef.current) {
        clearTimeout(playRequestRef.current);
      }
      setIsPlayRequested(false);
    };
  }, []);

  // Render functions
  const renderHeader = () => (
    showHeader && (
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
    )
  );

  const renderThumbnail = () => (
    <div 
      className={styles.thumbnailContainer}
      onClick={() => setShouldLoad(true)}
      role="button"
      tabIndex={0}
    >
      {thumbnailUrl && (
        <img 
          src={thumbnailUrl} 
          alt={clip.title}
          className={styles.thumbnail}
        />
      )}
      <div className={styles.playButton}>
        <MdPlayArrow size={48} className={styles.playIcon} />
      </div>
    </div>
  );

  const renderActions = () => (
    showActions && (
      <div className={clipStyles.clipStats}>
        <div className={clipStyles.statsContainer}>
          <div className={clipStyles.actionButtons}>
            {isOwner && (
              <div className={clipStyles.ownerActions}>
                <button
                  onClick={() => setShowDeleteModal(true)}
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
              onClick={handleLikesModalOpen}
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
    )
  );

  return (
    <div className={clipStyles.clipContainer}>
      {renderHeader()}
      {clip.title && <h3 className={clipStyles.clipTitle}>{clip.title}</h3>}

      <div className={`${styles.videoPlayerWrapper} ${styles.vidstackWrapper}`} data-playing={isPlaying}>
        {shouldLoad ? (
          <MediaPlayer
            ref={player}
            src={videoUrl}
            title={clip.title}
            load="visible"
            playsInline
            viewType="video"
            streamType="on-demand"
            autoplay={false}
            crossOrigin="anonymous"
            preload="metadata"
            buffer={4}
            onProviderChange={(provider) => {
              if (provider) {
                provider.setVolume?.(1);
                provider.setMuted?.(false);
              }
            }}
            onCanPlay={handleCanPlay}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onPlay={async () => {
              try {
                await handlePlayRequest();
                setIsPlaying(true);
                setHasStartedPlaying(true);
                setCurrentPlayingId(clip.id);
              } catch (error) {
                console.error('Error during play:', error);
              }
            }}
            onPause={() => {
              handlePauseRequest();
              setIsPlaying(false);
              setIsBuffering(false);
              if (currentPlayingId === clip.id) {
                setCurrentPlayingId(null);
              }
            }}
            onProgress={() => {
              setIsBuffering(false);
            }}
            onEnded={() => {
              setIsPlaying(false);
              if (currentPlayingId === clip.id) {
                setCurrentPlayingId(null);
              }
            }}
            onSeeking={() => {
              setIsSeeking(true);
            }}
            onSeeked={() => {
              setIsSeeking(false);
              setIsBuffering(false);
            }}
            onError={handleError}
          >
            <MediaProvider>
              <source 
                src={videoUrl}
                type={clip.file_path.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'}
              />
              {thumbnailUrl && !hasStartedPlaying && (
                <Poster
                  className="vds-poster"
                  src={thumbnailUrl}
                  alt={clip.title || 'Video thumbnail'}
                />
              )}
            </MediaProvider>

            <DefaultVideoLayout 
              icons={defaultLayoutIcons}
              thumbnails={thumbnailUrl}
              translations={{
                Play: 'Play',
                Pause: 'Pause',
                'Seek Backward': 'Backward',
                'Seek Forward': 'Forward',
                'Mute': 'Mute',
                'Unmute': 'Unmute',
                'Enter Fullscreen': 'Fullscreen',
                'Exit Fullscreen': 'Exit Fullscreen'
              }}
              smallLayoutWhen={({ width }) => width < 576}
            />

            {isPlaying && isBuffering && !isSeeking && !error && (
              <div className={styles.bufferingOverlay}>
                <div className={styles.bufferingSpinner} />
                <div className={styles.bufferingText}>Loading...</div>
              </div>
            )}

            {(error || hlsError) && (
              <div className={styles.errorOverlay}>
                <p>{error || hlsError}</p>
                <button onClick={() => {
                  setError(null);
                  setHlsError(null);
                  player.current?.startLoading();
                }}>
                  Retry
                </button>
              </div>
            )}
          </MediaPlayer>
        ) : renderThumbnail()}
      </div>

      {renderActions()}

      <DeleteClipModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          onClipDelete?.();
          setShowDeleteModal(false);
        }}
      />

      <LikesModal
        isOpen={showLikesModal}
        onClose={() => {
          setShowLikesModal(false);
          setModalTriggerRect(null);
        }}
        triggerRect={modalTriggerRect}
        likes={likesList}
        isLoading={isUpdatingLike}
        currentUserId={user?.id}
      />

      {isPlayRequested && !isPlaying && (
        <div className={styles.playingOverlay}>
          <div className={styles.playingSpinner} />
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 