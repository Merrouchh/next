import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from '../styles/VideoPlayer.module.css';
import { trackView } from '../utils/viewTracking';

// Dynamically import the video player component
const DynamicPlayer = dynamic(() => import('../components/DynamicVideoPlayer'), {
  ssr: false,
  loading: () => (
    <div className={styles.loadingPlayer}>
      <div className={styles.loadingSpinner}></div>
    </div>
  ),
});

const VideoPlayer = ({ clip, user, onLoadingChange, isInClipCard }) => {
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const playbackTimerRef = useRef(null);
  const anonymousIdRef = useRef(null);
  const playerRef = useRef(null);
  const wrapperRef = useRef(null);
  const trackingAttemptedRef = useRef(false);
  const timeoutIdsRef = useRef([]);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Generate or retrieve anonymous ID for non-logged-in users
  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      let anonId = localStorage.getItem('anonymousViewerId');
      if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('anonymousViewerId', anonId);
      }
      anonymousIdRef.current = anonId;
      console.log('Using anonymous ID:', anonId);
    }
  }, [user]);

  // Helper function to safely set timeouts that will be cleaned up
  const safeSetTimeout = (callback, delay) => {
    const id = setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter(timeoutId => timeoutId !== id);
      callback();
    }, delay);
    
    timeoutIdsRef.current.push(id);
    return id;
  };

  // Track view after 5 seconds of actual playback
  useEffect(() => {
    const handleViewTracking = async () => {
      if (!clip?.id || hasTrackedView || !isActuallyPlaying || isBuffering) return;

      console.log('View tracking check:', {
        playbackTime,
        hasTrackedView,
        clipId: clip.id,
        userId: user?.id,
        isActuallyPlaying,
        isBuffering,
        playerExists: !!playerRef.current
      });

      if (playbackTime >= 5) {
        console.log('View tracking conditions met, attempting to track view');
        try {
          const viewerId = user?.id || anonymousIdRef.current;
          if (viewerId) {
            console.log('Tracking view with:', {
              clipId: clip.id,
              viewerId,
              isAnonymous: !user
            });
            const viewCount = await trackView(clip.id, viewerId, !user);
            console.log('View tracked successfully:', viewCount);
            setHasTrackedView(true);
          }
        } catch (err) {
          console.error('Error tracking view:', err);
        }
      }
    };

    handleViewTracking();
  }, [playbackTime, hasTrackedView, clip?.id, user?.id, isActuallyPlaying, isBuffering]);

  // Handle player events from the dynamic component
  const handlePlayerEvent = (event, data) => {
    console.log('Player event:', event, data);
    switch (event) {
      case 'playerReady':
        console.log('Player ready for clip:', clip?.id);
        playerRef.current = data;
        break;
      case 'playing':
        setIsActuallyPlaying(true);
        setIsBuffering(false);
        setError(null); // Clear any previous errors on successful playback
        startPlaybackTracking();
        break;
      case 'waiting':
        setIsBuffering(true);
        onLoadingChange?.(true);
        break;
      case 'canplay':
        setIsBuffering(false);
        onLoadingChange?.(false);
        break;
      case 'pause':
        setIsActuallyPlaying(false);
        stopPlaybackTracking();
        break;
      case 'ended':
        setIsActuallyPlaying(false);
        stopPlaybackTracking();
        break;
      case 'error':
        // Only set error if we don't already have one
        if (!error) {
          setError(data || 'Failed to load video');
        }
        break;
    }
  };

  // Handle actual playback tracking
  const startPlaybackTracking = () => {
    console.log('Starting playback tracking');
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }

    playbackTimerRef.current = setInterval(() => {
      if (playerRef.current && !playerRef.current.paused) {
        const currentTime = playerRef.current.currentTime;
        const previousTime = playerRef.current.previousTime || currentTime;
        
        // Only increment if time has actually advanced
        if (currentTime > previousTime) {
          setPlaybackTime(prev => {
            const newTime = prev + 1;
            console.log('Playback time:', newTime, 'for clip:', clip?.id);
            return newTime;
          });
        }
        
        playerRef.current.previousTime = currentTime;
      }
    }, 1000);
  };

  const stopPlaybackTracking = () => {
    console.log('Stopping playback tracking');
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      playerRef.current = null;
      stopPlaybackTracking();
      
      // Clear all pending timeouts
      timeoutIdsRef.current.forEach(id => {
        clearTimeout(id);
      });
      timeoutIdsRef.current = [];
    };
  }, [clip?.id]);

  // Reset tracking state when clip changes
  useEffect(() => {
    console.log('Clip changed, resetting tracking state for clip:', clip?.id);
    setHasTrackedView(false);
    setPlaybackTime(0);
    setIsActuallyPlaying(false);
    trackingAttemptedRef.current = false;
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, [clip?.id]);

  const handleRetry = () => {
    setError(null);
  };

  return (
    <div className={`${styles.videoWrapper} ${isInClipCard ? styles.inClipCard : ''}`} ref={wrapperRef}>
      {clip && (
        <DynamicPlayer 
          clip={clip}
          onPlayerEvent={handlePlayerEvent}
          key={clip.cloudflare_uid} // Force re-render when clip changes
          isInClipCard={isInClipCard}
        />
      )}
      
      {error && (
        <div className={styles.errorOverlay}>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;