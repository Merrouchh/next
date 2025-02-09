import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { useVideo } from '../context/VideoContext';
import LikesModal from './LikesModal';
import { trackView } from '@/utils/viewTracking';
import { useLikes } from '../hooks/useLikes';
import DeleteClipModal from './DeleteClipModal';

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

  // Lazy loading state
  const [shouldLoad, setShouldLoad] = useState(false);
  const observerRef = useRef(null);

  // URLs
  const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}`;
  const thumbnailUrl = clip.thumbnail_path ? 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}` 
    : null;

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

  // Video event handlers
  const handleCanPlay = useCallback(() => {
    setCanPlay(true);
    setIsBuffering(false);
  }, []);

  const handleWaiting = useCallback(() => {
    if (isPlaying && !isSeeking) {
      setIsBuffering(true);
    }
  }, [isPlaying, isSeeking]);

  const handleError = useCallback((e) => {
    setError('Failed to load video');
    setCanPlay(false);
  }, []);

  // Intersection Observer setup
  useEffect(() => {
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
    // If another video starts playing (currentPlayingId changes to a different id)
    // and this video is currently playing, pause it
    if (currentPlayingId && currentPlayingId !== clip.id && isPlaying) {
      player.current?.pause().catch(err => {
        console.error('Error pausing video:', err);
      });
    }
  }, [currentPlayingId, clip.id, isPlaying]);

  // Action handlers
  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/clip/${clip.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: clip.title,
          text: `Check out this clip by ${clip.username}`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [clip.id, clip.title, clip.username]);

  const handleCopyLink = useCallback(async () => {
    try {
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      await navigator.clipboard.writeText(clipUrl);
      setShowCopyTooltip(true);
      setTimeout(() => setShowCopyTooltip(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy clip link');
    }
  }, [clip.id]);

  const handleVisibilityToggle = useCallback(async () => {
    if (!isOwner) return;
    
    try {
      const newVisibility = clip.visibility === 'public' ? 'private' : 'public';
      
      // Call the update handler with the updated clip
      onClipUpdate?.({
        ...clip,
        visibility: newVisibility
      });
      
    } catch (error) {
      console.error('Error toggling visibility:', error);
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

  // Add a new effect to handle auto-play
  useEffect(() => {
    if (shouldLoad && canPlay && !hasStartedPlaying) {
      player.current?.play().catch(err => {
        console.error('Auto-play failed:', err);
      });
    }
  }, [shouldLoad, canPlay, hasStartedPlaying]);

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
            aspectRatio={16/9}
            playsInline
            viewType="video"
            streamType="on-demand"
            autoplay={false}
            crossOrigin=""
            onProviderChange={(provider) => {
              if (provider) {
                provider.setVolume?.(1);
                provider.setMuted?.(false);
              }
            }}
            onCanPlay={handleCanPlay}
            onWaiting={handleWaiting}
            onPlay={() => {
              setIsPlaying(true);
              setHasStartedPlaying(true);
              setCurrentPlayingId(clip.id);
            }}
            onPause={() => {
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
              </div>
            )}

            {error && (
              <div className={styles.errorOverlay}>
                <p>{error}</p>
                <button onClick={() => {
                  setError(null);
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
    </div>
  );
};

export default VideoPlayer; 