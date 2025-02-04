import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { 
  MdPerson, 
  MdGames, 
  MdFavorite, 
  MdFavoriteBorder, 
  MdVisibility 
} from 'react-icons/md';
import styles from '../styles/VideoPlayer.module.css';
import clipStyles from '../styles/shared/ClipCard.module.css';
import { MediaPlayer, MediaProvider, Poster } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { updateLike, checkLikeStatus } from '../utils/supabase/clips';
import { useVideo } from '../context/VideoContext';

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
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(clip.likes_count || 0);
  const [error, setError] = useState(null);
  const [canPlay, setCanPlay] = useState(false);

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
      if (user && clip) {
        try {
          const isLiked = await checkLikeStatus(clip.id, user.id);
          setLiked(isLiked);
        } catch (error) {
          console.error('Failed to check like status:', error);
        }
      }
    };

    checkInitialLikeStatus();
  }, [clip.id, user?.id]);

  const handleLike = async () => {
    if (!user) return;
    
    const newLikedState = !liked;
    const newCount = likesCount + (newLikedState ? 1 : -1);
    
    setLiked(newLikedState);
    setLikesCount(newCount);

    try {
      await updateLike(clip.id, user.id, newLikedState);
    } catch (error) {
      setLiked(!newLikedState);
      setLikesCount(likesCount);
      console.error('Failed to update like:', error);
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
          src={clip.url}
          aspectRatio={16/9}
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
            if (isPlaying && e.currentTime > 5) {
              onViewCountUpdate?.(clip.id);
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
            {thumbnailUrl && (
              <Poster
                className="vds-poster"
                src={thumbnailUrl}
                alt={clip.title || 'Video thumbnail'}
                data-visible={!hasStartedPlaying}
              />
            )}
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
              <span>{clip.views_count || 0}</span>
            </div>
            <button
              onClick={handleLike}
              className={`${clipStyles.likeButton} ${liked ? clipStyles.liked : ''}`}
              disabled={!user}
              title={user ? (liked ? 'Unlike' : 'Like') : 'Sign in to like'}
            >
              {liked ? <MdFavorite /> : <MdFavoriteBorder />}
              <span>{likesCount}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 