import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  MdPerson, 
  MdGames, 
  MdFavorite, 
  MdFavoriteBorder, 
  MdVisibility,
  MdScreenRotation
} from 'react-icons/md';
import styles from '../styles/VideoPlayer.module.css';
import clipStyles from '../styles/ClipCard.module.css';
import { MediaPlayer, MediaProvider, Poster } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import { updateLike, checkLikeStatus, getLikesByClipId } from '../utils/supabase/clips';
import { useVideo } from '../context/VideoContext';
import LikesModal from './LikesModal';
import { trackView } from '@/utils/viewTracking';
import { useLikes } from '../hooks/useLikes';
import orientation from 'o9n';

const VideoPlayer = ({ 
  clip,
  user,
  onViewCountUpdate,
  onPlay,
  showActions = true,
  showHeader = true
}) => {
  const router = useRouter();
  const { currentPlayingId, setCurrentPlayingId } = useVideo();
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [canPlay, setCanPlay] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const likesButtonRef = useRef(null);
  const [modalTriggerRect, setModalTriggerRect] = useState(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [isRotated, setIsRotated] = useState(false);

  const {
    liked,
    setLiked,
    likesCount,
    setLikesCount,
    isUpdatingLike,
    likesList,
    setLikesList,
    handleLike,
    fetchLikes
  } = useLikes(false, clip.likes_count || 0);

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

  // Construct the full thumbnail URL
  const thumbnailUrl = clip.thumbnail_path ? 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}` 
    : null;

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

  useEffect(() => {
    const handleKeyPress = async (e) => {
      if (!playerRef.current) return;
      
      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          try {
            if (isPlaying) {
              playerRef.current.pause();
            } else if (canPlay) {
              await playerRef.current.play();
            }
          } catch (error) {
            console.error('Playback control error:', error);
          }
          break;
        case 'm':
          e.preventDefault();
          playerRef.current.muted = !playerRef.current.muted;
          break;
        case 'f':
          e.preventDefault();
          playerRef.current.requestFullscreen();
          break;
        case 'i':
          e.preventDefault();
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
          } else {
            playerRef.current.requestPictureInPicture();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, canPlay]);

  // Add effect to pause when another video starts playing
  useEffect(() => {
    if (currentPlayingId && currentPlayingId !== clip.id && isPlaying) {
      playerRef.current?.pause();
    }
  }, [currentPlayingId, clip.id, isPlaying]);

  // Safe play handler
  const handlePlay = async () => {
    try {
      if (canPlay) {
      setIsPlaying(true);
        setHasStartedPlaying(true);
        setCurrentPlayingId(clip.id);
        onPlay?.();
      }
    } catch (error) {
      console.error('Play error:', error);
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

  // Add handler for rotation and fullscreen
  const handleRotateFullscreen = async () => {
    if (!playerRef.current) return;

    try {
      // First enter fullscreen
      await playerRef.current.enterFullscreen();

      // Then try to lock orientation
      try {
        // Use o9n for locking only
        await orientation.lock('landscape');
        setIsRotated(true);
      } catch (orientationError) {
        console.log('Orientation lock not supported or denied:', orientationError);
      }
    } catch (error) {
      console.error('Fullscreen/Rotation error:', error);
      // If everything fails, just try fullscreen without rotation
      try {
        await playerRef.current.enterFullscreen();
      } catch (fsError) {
        console.error('Fullscreen fallback error:', fsError);
      }
    }
  };

  // Update fullscreen change listener to handle exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Release orientation lock when exiting fullscreen
        try {
          orientation.unlock();
          setIsRotated(false);
        } catch (error) {
          console.log('Orientation unlock error:', error);
        }
      }
    };

    // Listen for orientation changes using the standard API when available
    const handleOrientationChange = () => {
      if (screen.orientation) {
        console.log('Orientation changed:', screen.orientation.type, screen.orientation.angle);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Only add orientation listener if the API is available
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      // Cleanup orientation lock when component unmounts
      try {
        orientation.unlock();
      } catch (error) {
        console.log('Orientation unlock cleanup error:', error);
      }
    };
  }, []);

  return (
    <>
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
            src={clip.url}
            aspectRatio={16/9}
            playsInline
            style={{ width: '100%', height: '100%' }}
            onPlay={handlePlay}
            onPause={() => {
              setIsPlaying(false);
              if (currentPlayingId === clip.id) {
                setCurrentPlayingId(null);
              }
            }}
            onCanPlay={() => setCanPlay(true)}
            onWaiting={() => setCanPlay(false)}
            onTimeUpdate={(e) => {
              if (isPlaying && e.currentTime > 5 && !hasTrackedView) {
                setHasTrackedView(true);
                trackView(clip.id, user?.id).then(newCount => {
                  if (newCount !== null) {
                    // Update local view count if needed
                  }
                });
              }
            }}
            onError={(e) => {
              console.error('Video player error:', e);
              setError('Failed to load video');
              setCanPlay(false);
              if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
              }
            }}
          >
            <MediaProvider>
              <source src={clip.url} type="video/mp4" />
              <div className={styles.posterWrapper} style={{ width: '100%', height: '100%' }}>
                {thumbnailUrl && (
                  <Poster
                    className="vds-poster"
                    src={thumbnailUrl}
                    alt={clip.title || 'Video thumbnail'}
                    data-visible={!hasStartedPlaying}
                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                  />
                )}
              </div>
            </MediaProvider>
            <DefaultVideoLayout 
              icons={defaultLayoutIcons}
              translations={{
                play: 'Play',
                pause: 'Pause',
                mute: 'Mute',
                unmute: 'Unmute',
                fullscreen: 'Fullscreen',
                exitFullscreen: 'Exit Fullscreen',
                pictureInPicture: 'Picture in Picture',
                exitPictureInPicture: 'Exit Picture in Picture',
              }}
            />
            {error && (
              <div className={styles.errorOverlay}>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
              </div>
            )}
          </MediaPlayer>
          
          {/* Add rotate button for mobile */}
          <button
            className={styles.rotateButton}
            onClick={handleRotateFullscreen}
            title="Rotate and fullscreen"
          >
            <MdScreenRotation />
          </button>
        </div>

        {showActions && (
          <div className={clipStyles.clipStats}>
            <div className={clipStyles.statsContainer}>
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
      </div>

      <LikesModal
        isOpen={showLikesModal}
        onClose={handleModalClose}
        likes={likesList}
        triggerRect={modalTriggerRect}
      />
    </>
  );
};

export default VideoPlayer; 