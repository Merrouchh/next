import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  MdPerson, 
  MdGames, 
  MdFavorite, 
  MdFavoriteBorder, 
  MdVisibility 
} from 'react-icons/md';
import styles from '../styles/VideoPlayer.module.css';
import clipStyles from '../styles/ClipCard.module.css';
import { MediaPlayer, MediaProvider, Poster } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import { updateLike, checkLikeStatus, getLikesByClipId } from '../utils/supabase/clips';
import { useVideo } from '../context/VideoContext';
import LikesModal from './LikesModal';
import { trackView } from '@/utils/viewTracking';

const VideoPlayer = ({ 
  clip,
  user,
  onPlay,
  showActions = true,
  showHeader = true
}) => {
  const router = useRouter();
  const { currentPlayingId, setCurrentPlayingId } = useVideo();
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(clip.likes_count || 0);
  const [error, setError] = useState(null);
  const [canPlay, setCanPlay] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [modalTriggerRect, setModalTriggerRect] = useState(null);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [localViewCount, setLocalViewCount] = useState(clip.views_count || 0);

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

  useEffect(() => {
    const checkInitialLikeStatus = async () => {
      if (!user || !clip) return;

      try {
        const [isLiked, likes] = await Promise.all([
          checkLikeStatus(clip.id, user.id),
          getLikesByClipId(clip.id)
        ]);

        if (Array.isArray(likes)) {
          setLikesList(likes);
          setLikesCount(likes.length);
          // Use the likes array to determine liked status as source of truth
          const actualLikedStatus = likes.some(like => like.user_id === user.id);
          setLiked(actualLikedStatus);
        } else {
          setLiked(isLiked);
        }
      } catch (error) {
        console.error('Failed to check initial status:', error);
      }
    };

    checkInitialLikeStatus();
  }, [clip?.id, user?.id]);

  const handleLike = async () => {
    if (!user || isUpdatingLike) return;
    
    const newLikedState = !liked;
    const currentCount = likesCount;
    
    // Lock updates
    setIsUpdatingLike(true);
    
    // Local update first
    setLiked(newLikedState);
    setLikesCount(newLikedState ? currentCount + 1 : currentCount - 1);

    try {
      // Backend update
      await updateLike(clip.id, user.id, newLikedState);
      
      // Only fetch new data if modal is open
      if (showLikesModal) {
        const freshLikes = await getLikesByClipId(clip.id);
        if (Array.isArray(freshLikes)) {
          setLikesList(freshLikes);
        }
      }
    } catch (error) {
      // On error, revert to original state
      console.error('Failed to update like:', error);
      setLiked(!newLikedState);
      setLikesCount(currentCount);
    } finally {
      setIsUpdatingLike(false);
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
      // Get the clip container element
      const clipContainer = likesButtonRef.current.closest(`.${clipStyles.clipContainer}`);
      const containerRect = clipContainer.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      setModalTriggerRect({
        top: containerRect.top + scrollY,
        left: containerRect.left + (containerRect.width / 2) + scrollX,
        width: containerRect.width,
        height: containerRect.height,
        bottom: containerRect.bottom + scrollY,
        right: containerRect.right + scrollX
      });

      // Fetch likes only when opening modal
      const likes = await getLikesByClipId(clip.id);
      if (Array.isArray(likes)) {
        setLikesList(likes);
      }

      setShowLikesModal(true);
    }
  }, [clip.id, likesCount]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowLikesModal(false);
    setModalTriggerRect(null);
  }, []);

  // Reset likes list when clip changes
  useEffect(() => {
    if (clip?.id) {
      setLikesList([]); // Reset likes list
    }
    return () => {
      setLikesList([]); // Cleanup
      setShowLikesModal(false); // Close modal if open
      setModalTriggerRect(null);
    };
  }, [clip?.id]);

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
                console.log('Attempting to track view:', {
                  clipId: clip.id,
                  userId: user?.id,
                  currentTime: e.currentTime
                });
                
                setHasTrackedView(true);
                trackView(clip.id, user?.id).then(newCount => {
                  console.log('View tracked, new count:', newCount);
                  if (newCount !== null) {
                    setLocalViewCount(newCount);
                  }
                }).catch(error => {
                  console.error('Error tracking view:', error);
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
        </div>

        {showActions && (
          <div className={clipStyles.clipStats}>
            <div className={clipStyles.statsContainer}>
              <div className={clipStyles.viewCount}>
                <MdVisibility />
                <span>{localViewCount}</span>
              </div>
              <div className={clipStyles.likeContainer}>
                <button
                  onClick={handleLike}
                  className={`${clipStyles.likeButton} ${liked ? clipStyles.liked : ''}`}
                  disabled={!user}
                  title={user ? (liked ? 'Unlike' : 'Like') : 'Sign in to like'}
                >
                  {liked ? <MdFavorite /> : <MdFavoriteBorder />}
                </button>
                <div 
                  ref={likesButtonRef}
                  role="button"
                  onClick={handleModalOpen}
                  className={clipStyles.likesCount}
                  style={{ cursor: likesCount > 0 ? 'pointer' : 'default' }}
                  title={likesCount > 0 ? "Click to see who liked this" : "No likes yet"}
                >
                  {likesCount}
                </div>
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