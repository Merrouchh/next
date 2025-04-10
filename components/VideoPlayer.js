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
  const anonymousIdRef = useRef(null);
  const playerRef = useRef(null);
  const wrapperRef = useRef(null);
  const trackingAttemptedRef = useRef(false);
  const viewTrackingTimeout = useRef(null);
  const lastTimeUpdateRef = useRef(0);
  const [error, setError] = useState(null);

  // Generate or retrieve anonymous ID for non-logged-in users
  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      let anonId = localStorage.getItem('anonymousViewerId');
      if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('anonymousViewerId', anonId);
      }
      anonymousIdRef.current = anonId;
      console.log('[View Tracking] Using anonymous ID:', anonId.substring(0, 8) + '...');
    }
  }, [user]);

  // Track view after continuous playback 
  useEffect(() => {
    // Log critical changes to playback state
    if (playbackTime === 1 || playbackTime === 5) {
      console.log('[View Tracking] Playback state:', { 
        playbackTime, 
        isActuallyPlaying, 
        isBuffering,
        hasTrackedView
      });
    }

    if (!clip?.id || hasTrackedView || !isActuallyPlaying || isBuffering) {
      return;
    }

    // Check if we've reached the threshold for tracking (5 seconds)
    if (playbackTime >= 5) {
      console.log('[View Tracking] Playback threshold reached (5s) - ready to track view');
      
      if (!trackingAttemptedRef.current) {
        console.log('[View Tracking] Attempting to track view now...');
        trackingAttemptedRef.current = true;
        
        const trackViewAsync = async () => {
          try {
            const viewerId = user?.id || anonymousIdRef.current;
            if (viewerId) {
              console.log('[View Tracking] Calling trackView with:', { 
                clipId: clip.id, 
                viewerId: viewerId.substring(0, 8) + '...',
                isAnonymous: !user 
              });
              
              const viewCount = await trackView(clip.id, viewerId, !user);
              
              if (viewCount !== null) {
                console.log('[View Tracking] View successfully tracked and counted:', viewCount);
                setHasTrackedView(true);
              } else {
                console.log('[View Tracking] View tracking returned null - may be a duplicate');
              }
            } else {
              console.error('[View Tracking] No viewerId available for tracking');
            }
          } catch (err) {
            console.error('[View Tracking] Error tracking view:', err);
            trackingAttemptedRef.current = false;
          }
        };
        
        trackViewAsync();
      }
    }
  }, [playbackTime, hasTrackedView, clip?.id, user?.id, isActuallyPlaying, isBuffering]);

  // Handle player events from the Cloudflare Stream player
  const handlePlayerEvent = (event, data) => {
    switch (event) {
      case 'playerReady':
        playerRef.current = data;
        break;
      case 'playing':
        if (!isActuallyPlaying) {
          console.log('[View Tracking] Video is now playing');
        }
        setIsActuallyPlaying(true);
        setIsBuffering(false);
        setError(null);
        break;
      case 'timeUpdate':
        if (data) {
          const currentTime = data.currentTime || 0;
          const isVideoPlaying = data.isPlaying === true;
          const isTimeProgressing = data.isTimeProgressing === true;
          
          // Update the actually playing state based on player behavior
          if (isVideoPlaying !== isActuallyPlaying || (isTimeProgressing && !isActuallyPlaying)) {
            const newPlayingState = isVideoPlaying || isTimeProgressing;
            if (newPlayingState !== isActuallyPlaying) {
              console.log(`[View Tracking] Video playing state changed to: ${newPlayingState}`);
              setIsActuallyPlaying(newPlayingState);
            }
          }
          
          // Increment playback time when time is actually advancing
          if (currentTime > lastTimeUpdateRef.current && (isVideoPlaying || isTimeProgressing)) {
            lastTimeUpdateRef.current = currentTime;
            
            setPlaybackTime(prev => {
              const newTime = prev + 1;
              if (newTime % 5 === 0) { // Log every 5 seconds
                console.log(`[View Tracking] Playback time: ${newTime}s`);
              }
              return newTime;
            });
          }
        }
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
        if (isActuallyPlaying) {
          console.log('[View Tracking] Video paused');
        }
        setIsActuallyPlaying(false);
        break;
      case 'ended':
        console.log('[View Tracking] Video ended');
        setIsActuallyPlaying(false);
        break;
      case 'error':
        console.error('[View Tracking] Video error:', data);
        setError(data || 'Failed to load video');
        break;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      playerRef.current = null;
      lastTimeUpdateRef.current = 0;
      
      if (viewTrackingTimeout.current) {
        clearTimeout(viewTrackingTimeout.current);
        viewTrackingTimeout.current = null;
      }
    };
  }, []);

  // Reset tracking state when clip changes
  useEffect(() => {
    console.log('[View Tracking] Clip changed - resetting tracking for clip ID:', clip?.id);
    setHasTrackedView(false);
    setPlaybackTime(0);
    setIsActuallyPlaying(false);
    trackingAttemptedRef.current = false;
    lastTimeUpdateRef.current = 0;
    
    if (viewTrackingTimeout.current) {
      clearTimeout(viewTrackingTimeout.current);
      viewTrackingTimeout.current = null;
    }
  }, [clip?.id]);

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
            onClick={() => setError(null)}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;