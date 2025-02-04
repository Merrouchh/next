import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { MdPerson, MdGames, MdFavorite, MdFavoriteBorder, MdShare, MdVisibility, MdPlayArrow, MdPause, MdVolumeUp, MdVolumeOff, MdFullscreen, MdDelete, MdPublic, MdLock } from 'react-icons/md';
import { BsFillPlayFill } from 'react-icons/bs';
import { getVisitorId } from '../utils/visitor-id';
import styles from '../styles/VideoPlayer.module.css';
import clipStyles from '../styles/shared/ClipCard.module.css';
import monitoring from '../utils/monitoring';
import LoadingClip from './LoadingClip';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const VideoPlayer = ({ 
  clip,
  user,
  supabase,
  onViewCountUpdate,
  onLikeUpdate,
  playing = false,
  onPlay,
  showActions = true,
  showHeader = true,
  isOwner = false,
  onClipUpdate,
  onClipDelete
}) => {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const viewTimeoutRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const [copiedClipId, setCopiedClipId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef(null);
  const playerRef = useRef(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [player, setPlayer] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [viewTracked, setViewTracked] = useState(false);
  const viewCountTimeout = useRef(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const bufferRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const hideControlsWithDelay = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
    setShowThumbnail(false);
    setShowControls(true);
    if (!isPlaying) {
      hideControlsWithDelay();
    }
  }, [isPlaying, hideControlsWithDelay]);

  const handleVideoTouch = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!showControls) {
      setShowControls(true);
      hideControlsWithDelay();
    } else {
      handlePlayPause();
    }
  }, [showControls, hideControlsWithDelay, handlePlayPause]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement || 
                          document.webkitFullscreenElement || 
                          document.mozFullScreenElement || 
                          document.msFullscreenElement;
      
      setShowControls(true);
      hideControlsWithDelay();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [hideControlsWithDelay]);

  const getVideoUrl = () => {
    if (clip?.url) return clip.url;
    if (!clip?.file_path) return null;
    try {
      const { data } = supabase.storage
        .from('highlight-clips')
        .getPublicUrl(clip.file_path);
      return data?.publicUrl;
    } catch (err) {
      console.error('Error getting video URL:', err);
      return null;
    }
  };

  const getThumbnailUrl = () => {
    if (clip?.thumbnailUrl) return clip.thumbnailUrl;
    if (!clip?.thumbnail_path) return getVideoUrl();
    return supabase.storage
      .from('highlight-clips')
      .getPublicUrl(clip.thumbnail_path)
      ?.data?.publicUrl;
  };

  const videoUrl = getVideoUrl();
  const thumbnailUrl = getThumbnailUrl();

  useEffect(() => {
    if (user && clip?.id) {
      fetchLikeStatus();
    }
  }, [user, clip?.id]);

  const fetchLikeStatus = async () => {
    if (!user?.id || !clip?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('video_likes')
        .select('*')
        .eq('clip_id', parseInt(clip.id))
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching like status:', error);
        return;
      }
      
      setLiked(!!data);
    } catch (err) {
      console.error('Error fetching like status:', err);
    }
  };

  const handleLike = async () => {
    if (!user) return;

    try {
      const newLiked = !liked;
      const { error } = await supabase
        .from('clips')
        .update({ likes_count: clip.likes_count + (newLiked ? 1 : -1) })
        .eq('id', clip.id);

      if (error) throw error;

      if (newLiked) {
        await supabase
          .from('video_likes')
          .insert({ user_id: user.id, clip_id: clip.id });
      } else {
        await supabase
          .from('video_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('clip_id', clip.id);
      }

      setLiked(newLiked);
      onLikeUpdate?.(clip.id, clip.likes_count + (newLiked ? 1 : -1));
    } catch (err) {
      console.error('Error updating like:', err);
    }
  };

  const handleShare = async () => {
    try {
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      if (navigator.share) {
        await navigator.share({
          title: clip.title || 'Gaming Clip',
          text: `Check out this gaming clip by ${clip.username}!`,
          url: clipUrl
        });
      } else {
        await navigator.clipboard.writeText(clipUrl);
        setCopiedClipId(clip.id);
        setTimeout(() => setCopiedClipId(null), 2000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  useEffect(() => {
    if (playing) {
      setShowThumbnail(false);
      setIsPlaying(true);
    } else {
      setShowThumbnail(true);
      setIsPlaying(false);
    }
  }, [playing]);

  const handleViewCount = async (supabase, clipId, visitorId) => {
    try {
      if (!visitorId || !clipId) {
        console.error('Missing required parameters:', { clipId, visitorId });
        return null;
      }

      // Convert clipId to number and validate
      const numericClipId = parseInt(clipId);
      if (isNaN(numericClipId)) {
        console.error('Invalid clip ID:', clipId);
        return null;
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .replace('Z', '');
      
      // Check for existing view
      const { data: existingView, error: viewError } = await supabase
        .from('clip_views')
        .select('*')
        .eq('clip_id', numericClipId)
        .eq('visitor_id', visitorId)
        .gte('created_at', twentyFourHoursAgo)
        .single();

      if (viewError && viewError.code !== 'PGRST116') {
        console.error('Error checking existing view:', viewError);
        return null;
      }

      if (existingView) {
        console.log('View already exists within 24 hours');
        return null;
      }

      // Call the RPC function
      const { data: newViewCount, error } = await supabase.rpc('increment_view_count', {
        clip_id_param: numericClipId,
        visitor_id_param: visitorId.toString()
      });

      if (error) {
        console.error('Error in increment_view_count:', error);
        throw error;
      }

      if (typeof newViewCount !== 'number') {
        console.error('Invalid response from increment_view_count:', newViewCount);
        return null;
      }

      return newViewCount;
    } catch (err) {
      console.error('Error tracking view:', err);
      return null;
    }
  };

  const handleVideoPlay = useCallback(async () => {
    setIsPlaying(true);
    setShowThumbnail(false);
    onPlay?.();

    if (!clip?.id || !isReady) return;

    try {
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current);
      }

      if (!viewTracked) {
        viewTimeoutRef.current = setTimeout(async () => {
          const visitorId = await getVisitorId(user?.id);
          const newViewCount = await handleViewCount(supabase, clip.id, visitorId);
          
          if (newViewCount !== null) {
            setViewTracked(true);
            onViewCountUpdate?.(clip.id, newViewCount);
          }
        }, 5000);
      }
    } catch (err) {
      console.error('Error handling video play:', err);
    }
  }, [clip?.id, isReady, onViewCountUpdate, onPlay, user?.id, viewTracked, supabase]);

  const handlePause = () => {
    if (!isSeeking) {
      setIsPlaying(false);
    }
  };

  const handleProgress = ({ played }) => {
    if (!isSeeking) {
      setProgress(played * 100);
      
      if (player && player.buffered && bufferRef.current) {
        try {
          const buffered = player.buffered;
          if (buffered.length > 0) {
            const bufferedEnd = buffered.end(buffered.length - 1);
            const duration = player.duration;
            if (duration > 0) {
              bufferRef.current.style.width = `${(bufferedEnd / duration) * 100}%`;
            }
          }
        } catch (err) {
          console.error('Error updating buffer progress:', err);
        }
      }
    }
  };

  const handleDuration = (duration) => {
    setDuration(duration);
  };

  const onReady = useCallback((reactPlayer) => {
    setIsLoading(false);
    setVideoError(false);
    setIsReady(true);
    const videoElement = reactPlayer.getInternalPlayer();
    if (videoElement && videoElement.tagName === 'VIDEO') {
      videoElement.preload = "auto";
      videoElement.autoplay = false;
      videoElement.playsInline = true;
      
      // Set maximum buffer size
      if ('buffered' in videoElement) {
        try {
          const bufferSize = 300; // 5 minutes
          if (videoElement.duration) {
            videoElement.preload = Math.min(bufferSize, videoElement.duration);
          }
        } catch (err) {
          console.error('Error setting buffer size:', err);
        }
      }

      // Set larger playback buffer
      if ('mediaSource' in window) {
        try {
          videoElement.bufferSize = 500 * 1000 * 1000; // 500MB buffer
        } catch (err) {
          console.error('Error setting media source buffer:', err);
        }
      }

      // Enable hardware acceleration
      try {
        videoElement.style.transform = 'translateZ(0)';
        videoElement.style.willChange = 'transform';
      } catch (err) {
        console.error('Error enabling hardware acceleration:', err);
      }

      setPlayer(videoElement);
    }
  }, []);

  const handleProgressClick = useCallback((e) => {
    if (!progressRef.current || !duration || !isReady) return;
    
    const bounds = progressRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const width = bounds.width;
    const percentage = Math.min(Math.max(0, x / width), 1);
    const timeToSeek = percentage * duration;
    
    try {
      setProgress(percentage * 100);
      setIsPlaying(true);
      setShowThumbnail(false);
      
      if (player && typeof player.currentTime === 'number') {
        player.currentTime = timeToSeek;
      }
    } catch (err) {
      console.error('Error seeking:', err);
    }
  }, [duration, isReady, player]);

  const handleProgressDrag = useCallback((e) => {
    if (!progressRef.current || !duration || !isReady) return;
    
    const bounds = progressRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - bounds.left), bounds.width);
    const percentage = x / bounds.width;
    const timeToSeek = percentage * duration;
    
    try {
      setProgress(percentage * 100);
      setIsPlaying(true);
      setShowThumbnail(false);
      
      if (player && typeof player.currentTime === 'number') {
        player.currentTime = timeToSeek;
      }
    } catch (err) {
      console.error('Error seeking:', err);
    }
  }, [duration, isReady, player]);

  useEffect(() => {
    setIsReady(false);
    setPlayer(null);
    setProgress(0);
    setDuration(0);
  }, [clip?.id]);

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (isMuted) {
      setVolume(1);
    } else {
      setVolume(0);
    }
  };

  const toggleFullScreen = useCallback(async () => {
    try {
      const videoElement = document.querySelector('video');
      const container = containerRef.current;
      
      if (!videoElement || !container) return;

      // Check if we're in fullscreen mode
      const isFullscreen = document.fullscreenElement || 
                          document.webkitFullscreenElement || 
                          document.mozFullScreenElement || 
                          document.msFullscreenElement;

      if (!isFullscreen) {
        // Enter fullscreen
        if (videoElement.webkitEnterFullscreen) {
          // iOS Safari
          await videoElement.webkitEnterFullscreen();
        } else if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          await container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          await container.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  const handleError = async (error) => {
    await monitoring.logError(error, {
      videoSrc: videoUrl,
      playerState: playerRef.current?.getState()
    });
    console.error('Video loading error:', error);
    setVideoError(true);
    setIsLoading(false);
  };

  const retryVideoLoad = () => {
    setVideoError(false);
    setIsLoading(true);
    setIsReady(false);
    setPlayer(null);
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    return () => {
      setPlayer(null);
      setIsReady(false);
      setProgress(0);
      setDuration(0);
      
      if (viewCountTimeout.current) {
        clearTimeout(viewCountTimeout.current);
      }
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current);
      }
      
      const startTime = performance.now();
      monitoring.logPerformance('video_session', performance.now() - startTime);
      
      setIsPlaying(false);
      setShowThumbnail(true);
      setIsSeeking(false);
      setLiked(false);
      setCopiedClipId(null);
      setVideoError(false);
      setIsLoading(true);
      setViewTracked(false);
    };
  }, [clip?.id]);

  const handleVisibilityToggle = async () => {
    if (!isOwner || isUpdating) return;
    
    try {
      setIsUpdating(true);
      const newVisibility = clip.visibility === 'public' ? 'private' : 'public';
      
      const { data, error } = await supabase
        .from('clips')
        .update({ visibility: newVisibility })
        .eq('id', clip.id)
        .select()
        .single();

      if (error) throw error;

      if (typeof onClipUpdate === 'function') {
        onClipUpdate(data);
      } else {
        router.reload();
      }
    } catch (err) {
      console.error('Error updating visibility:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner || isDeleting) return;
    
    try {
      setIsDeleting(true);
      
      if (clip.file_path) {
        const { error: storageError } = await supabase.storage
          .from('highlight-clips')
          .remove([clip.file_path]);
        
        if (storageError) throw storageError;
      }

      if (clip.thumbnail_path) {
        await supabase.storage
          .from('highlight-clips')
          .remove([clip.thumbnail_path]);
      }

      const { error: dbError } = await supabase
        .from('clips')
        .delete()
        .eq('id', clip.id);

      if (dbError) throw dbError;

      onClipDelete?.(clip.id);
    } catch (err) {
      console.error('Error deleting clip:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    if (videoUrl) {
      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      
      const handleCanPlay = () => {
        if (mounted) {
          setIsLoading(false);
        }
      };

      const handleError = () => {
        if (mounted) {
          setVideoError(true);
          setIsLoading(false);
        }
      };

      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('error', handleError);

      return () => {
        mounted = false;
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        videoElement.remove();
      };
    }
  }, [videoUrl]);

  const handlePlay = useCallback(() => {
    handleVideoPlay();
    onPlay?.();
    
    if (viewCountTimeout.current) {
      clearTimeout(viewCountTimeout.current);
    }
  }, [onPlay, handleVideoPlay]);

  useEffect(() => {
    return () => {
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current);
      }
      if (viewCountTimeout.current) {
        clearTimeout(viewCountTimeout.current);
      }
      setViewTracked(false);
    };
  }, []);

  useEffect(() => {
    setViewTracked(false);
    if (viewTimeoutRef.current) {
      clearTimeout(viewTimeoutRef.current);
    }
    if (viewCountTimeout.current) {
      clearTimeout(viewCountTimeout.current);
    }
  }, [clip?.id]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current = null;
      }
      if (player) {
        setPlayer(null);
      }
    };
  }, [player]);

  const handleClickPreview = () => {
    if (onPlay) {
      onPlay();
    }
  };

  const renderDeleteConfirmation = () => {
    if (!showDeleteConfirm) return null;

    return (
      <div className={styles.deleteConfirmation}>
        <h3>Delete Clip</h3>
        <p>Are you sure you want to delete this clip? This action cannot be undone.</p>
        <div className={styles.deleteActions}>
          <button 
            onClick={() => setShowDeleteConfirm(false)}
            className={styles.cancelButton}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            onClick={handleDelete}
            className={styles.deleteButton}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    );
  };

  const renderDeletingState = () => {
    if (!isDeleting) return null;

    return (
      <div className={styles.deletingState}>
        <span>Deleting clip...</span>
      </div>
    );
  };

  const handleBuffer = () => {
    setIsBuffering(true);
  };

  const handleBufferEnd = () => {
    setIsBuffering(false);
  };

  const playerConfig = {
    file: {
      attributes: {
        preload: "auto",
        controlsList: "nodownload",
        playsInline: true,
        webkitPlaysInline: true,
        autoPlay: false,
        fetchPriority: "high",
        importance: "high",
        loading: "eager",
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }
      },
      forceVideo: true,
      hlsOptions: {
        enableWorker: true,
        startLevel: -1,
        maxBufferLength: 180, // 3 minutes
        maxMaxBufferLength: 300, // 5 minutes
        maxBufferSize: 250 * 1000 * 1000, // 250MB (Adjusted)
        backBufferLength: 180,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 30000,
        levelLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 10,
        manifestLoadingMaxRetry: 10,
        levelLoadingMaxRetry: 10,
        autoStartLoad: true,
        startFragPrefetch: true,
        lowLatencyMode: false,
        progressive: true,
        testBandwidth: true,
        abrEwmaDefaultEstimate: 1000000, // 1Mbps initial estimate
        abrBandWidthFactor: 0.9,
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: true,
        maxLoadingDelay: 2, // Kept only one instance
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        enableWebVTT: false,
        enableIMSC1: false,
        enableCEA708Captions: false,
        stretchShortVideoTrack: true,
        maxAudioFramesDrift: 1,
        forceKeyFrameOnDiscontinuity: false, // Changed for stability
        abrEwmaFastLive: 3,
        abrEwmaSlowLive: 9,
        abrEwmaFastVoD: 3,
        abrEwmaSlowVoD: 9,
        maxStarvationDelay: 4
      }
    }
  };

  // Add this effect to handle auto-hiding controls when playing
  useEffect(() => {
    if (isPlaying) {
      hideControlsWithDelay();
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying, hideControlsWithDelay]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Add this effect to preload the next chunk when near the end
  useEffect(() => {
    if (player && duration) {
      const preloadThreshold = 0.6; // Start preloading earlier, at 60%
      const currentTime = (progress / 100) * duration;
      
      if (currentTime / duration > preloadThreshold) {
        try {
          const nextTime = Math.min(currentTime + 60, duration); // Preload next minute
          if (player.buffered && player.buffered.length) {
            const bufferedEnd = player.buffered.end(player.buffered.length - 1);
            if (nextTime > bufferedEnd) {
              player.preload = "auto";
              // Try to force preload of next chunk
              const timeToPreload = Math.min(nextTime + 30, duration);
              player.currentTime = timeToPreload;
              player.currentTime = currentTime;
            }
          }
        } catch (err) {
          console.error('Error preloading next chunk:', err);
        }
      }
    }
  }, [progress, duration, player]);

  // Add this function to preload videos
  const preloadVideo = useCallback(async (url) => {
    try {
      // Add preload link
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      link.importance = 'high';
      document.head.appendChild(link);

      // Prefetch video data
      const response = await fetch(url, {
        method: 'HEAD',
        importance: 'high',
        priority: 'high'
      });

      // If video is not too large, preload it entirely
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) < 100 * 1024 * 1024) { // Less than 100MB
        fetch(url, {
          importance: 'high',
          priority: 'high'
        });
      }
    } catch (err) {
      console.error('Error preloading video:', err);
    }
  }, []);

  // Add this effect to preload the video when component mounts
  useEffect(() => {
    if (videoUrl) {
      preloadVideo(videoUrl);
    }
  }, [videoUrl, preloadVideo]);

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

      <div className={styles.videoPlayerContainer} ref={containerRef}>
        <div 
          className={`${styles.videoWrapper} ${!showControls ? styles.hideControls : ''}`}
          onClick={handleVideoTouch}
          onMouseMove={() => {
            if (isPlaying) {
              setShowControls(true);
              hideControlsWithDelay();
            }
          }}
        >
          {isLoading && !videoError && (
            <div className={styles.loadingOverlay}>
              <LoadingClip />
            </div>
          )}
          {videoError ? (
            <div className={styles.errorOverlay}>
              <p>Error loading video</p>
              <button onClick={retryVideoLoad}>Retry</button>
            </div>
          ) : (
            <ReactPlayer
              key={`${clip.id}-${retryCount}`}
              ref={playerRef}
              url={videoUrl}
              width="100%"
              height="100%"
              controls={false}
              playsinline={true}
              playing={isPlaying}
              onReady={onReady}
              onBuffer={handleBuffer}
              onBufferEnd={handleBufferEnd}
              onError={handleError}
              onProgress={handleProgress}
              onDuration={handleDuration}
              onPlay={handlePlay}
              onPause={handlePause}
              config={playerConfig}
              progressInterval={1000}
              light={showThumbnail ? thumbnailUrl : false}
              fallback={<LoadingClip />}
              pip={false}
              stopOnUnmount={false}
              volume={isMuted ? 0 : volume}
              muted={isMuted}
              playbackRate={1}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            />
          )}
          
          <div 
            className={`${styles.customControls} ${!showControls ? styles.hidden : ''}`}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => {
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
            }}
            onMouseLeave={() => {
              if (isPlaying) {
                hideControlsWithDelay();
              }
            }}
          >
            <div 
              className={styles.progressBar} 
              ref={progressRef}
              onClick={handleProgressClick}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsSeeking(true);
                handleProgressDrag(e);
              }}
              onMouseMove={(e) => {
                e.stopPropagation();
                if (isSeeking) {
                  handleProgressDrag(e);
                }
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                if (isSeeking) {
                  setIsSeeking(false);
                  if (isPlaying) {
                    setShowThumbnail(false);
                  }
                }
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                if (isSeeking) {
                  setIsSeeking(false);
                  if (isPlaying) {
                    setShowThumbnail(false);
                  }
                }
              }}
            >
              <div 
                className={styles.bufferProgress}
                ref={bufferRef}
              />
              <div 
                className={styles.progressFilled}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className={styles.controlsBottom}>
              <div className={styles.leftControls}>
                <button 
                  className={styles.controlButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPause();
                  }}
                >
                  {isPlaying ? <MdPause /> : <MdPlayArrow />}
                </button>

                <div className={styles.volumeControl}>
                  <button 
                    className={styles.controlButton}
                    onClick={toggleMute}
                  >
                    {isMuted || volume === 0 ? <MdVolumeOff /> : <MdVolumeUp />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={volume}
                    onChange={handleVolumeChange}
                    className={styles.volumeSlider}
                  />
                </div>

                <div className={styles.timeDisplay}>
                  <span>{formatTime(duration * (progress / 100))}</span>
                  <span> / </span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className={styles.rightControls}>
                <button 
                  className={styles.controlButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFullScreen();
                  }}
                >
                  <MdFullscreen />
                </button>
              </div>
            </div>
          </div>
        </div>
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
              <span>{clip.likes_count || 0}</span>
            </button>
          </div>

          <div className={clipStyles.clipActions}>
            {isOwner && (
              <>
                <button
                  onClick={handleVisibilityToggle}
                  className={`${clipStyles.actionButton} ${isUpdating ? clipStyles.disabled : ''}`}
                  disabled={isUpdating}
                  title={clip.visibility === 'public' ? 'Make Private' : 'Make Public'}
                >
                  {clip.visibility === 'public' ? <MdPublic /> : <MdLock />}
                </button>
                
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={`${clipStyles.actionButton} ${clipStyles.deleteButton} ${isUpdating ? clipStyles.disabled : ''}`}
                  disabled={isUpdating}
                  title="Delete Clip"
                >
                  <MdDelete />
                </button>
              </>
            )}
            <button
              onClick={handleShare}
              className={clipStyles.actionButton}
              title={copiedClipId === clip.id ? 'Copied!' : 'Share'}
            >
              <MdShare />
            </button>
          </div>
        </div>
      )}

      {renderDeleteConfirmation()}
      {renderDeletingState()}
    </div>
  );
};

export default VideoPlayer; 