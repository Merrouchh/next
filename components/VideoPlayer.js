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
import { updateLike, checkLikeStatus, getLikesByClipId } from '../utils/supabase/clips';
import { useVideo } from '../context/VideoContext';
import LikesModal from './LikesModal';
import { trackView } from '@/utils/viewTracking';
import { useLikes } from '../hooks/useLikes';
import { supabase } from '../utils/supabase/client';
import DeleteClipModal from './DeleteClipModal';

const VideoPlayer = ({ 
  clip,
  user,
  onViewCountUpdate,
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
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const likesButtonRef = useRef(null);
  const [modalTriggerRect, setModalTriggerRect] = useState(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCopyTooltip, setShowCopyTooltip] = useState(false);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('720p');
  const [availableQualities, setAvailableQualities] = useState([]);
  const [isAutoQuality, setIsAutoQuality] = useState(true);

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

  const handleDelete = async () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
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

  // Initialize quality settings based on network conditions
  useEffect(() => {
    if (!clip?.video_variants) return;
    
    const qualities = Object.keys(clip.video_variants);
    setAvailableQualities(qualities);
    
    // Auto-select initial quality based on connection
    if (isAutoQuality && navigator.connection) {
      const connection = navigator.connection;
      if (connection.effectiveType === '4g' && !connection.saveData) {
        setCurrentQuality('720p');
      } else {
        setCurrentQuality('480p');
      }
    }
  }, [clip, isAutoQuality]);

  // Monitor network changes
  useEffect(() => {
    if (!isAutoQuality) return;

    const handleNetworkChange = () => {
      if (!navigator.connection) return;
      
      const connection = navigator.connection;
      if (connection.effectiveType === '4g' && !connection.saveData) {
        setCurrentQuality('720p');
      } else {
        setCurrentQuality('480p');
      }
    };

    if (navigator.connection) {
      navigator.connection.addEventListener('change', handleNetworkChange);
      return () => navigator.connection.removeEventListener('change', handleNetworkChange);
    }
  }, [isAutoQuality]);

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
            load="idle"
            preload="metadata"
            title={clip.title}
            src={clip.video_variants ? clip.video_variants[currentQuality] : clip.url}
            aspectRatio={16/9}
            playsInline
            style={{ width: '100%', height: '100%' }}
            onPlay={handlePlay}
            onLoadedMetadata={() => {
              setHasLoadedMetadata(true);
              setCanPlay(true);
            }}
            onPause={() => {
              setIsPlaying(false);
              if (currentPlayingId === clip.id) {
                setCurrentPlayingId(null);
              }
            }}
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
              {clip.video_variants ? (
                Object.entries(clip.video_variants).map(([quality, url]) => (
                  <source 
                    key={quality}
                    src={url} 
                    type="video/mp4"
                    preload="metadata"
                    size={quality === '720p' ? 1280 : quality === '480p' ? 854 : 640}
                  />
                ))
              ) : (
                <source 
                  src={clip.url} 
                  type="video/mp4"
                  preload="metadata"
                />
              )}
              <div className={styles.posterWrapper} style={{ width: '100%', height: '100%' }}>
                {thumbnailUrl && (
                  <Poster
                    className="vds-poster"
                    src={thumbnailUrl}
                    alt={clip.title || 'Video thumbnail'}
                    data-visible={!hasStartedPlaying || !hasLoadedMetadata}
                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                  />
                )}
              </div>
            </MediaProvider>
            <DefaultVideoLayout 
              icons={defaultLayoutIcons}
              customControls={
                clip.video_variants && (
                  <div className={styles.qualityControls}>
                    <button
                      onClick={() => setIsAutoQuality(!isAutoQuality)}
                      className={`${styles.qualityButton} ${isAutoQuality ? styles.active : ''}`}
                      title="Auto quality"
                    >
                      AUTO
                    </button>
                    {availableQualities.map(quality => (
                      <button
                        key={quality}
                        onClick={() => {
                          setIsAutoQuality(false);
                          setCurrentQuality(quality);
                        }}
                        className={`${styles.qualityButton} ${
                          !isAutoQuality && currentQuality === quality ? styles.active : ''
                        }`}
                      >
                        {quality}
                      </button>
                    ))}
                  </div>
                )
              }
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
      </div>

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
    </>
  );
};

export default VideoPlayer; 