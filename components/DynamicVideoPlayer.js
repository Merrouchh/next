import React, { useEffect, useRef } from 'react';
import styles from '../styles/VideoPlayer.module.css';

const DynamicVideoPlayer = ({ clip, onPlayerEvent, isInClipCard }) => {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);

  useEffect(() => {
    // Load Cloudflare Stream SDK
    const loadStreamSDK = async () => {
      if (!window.Stream) {
        const script = document.createElement('script');
        script.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
        script.async = true;
        script.onload = initializePlayer;
        document.body.appendChild(script);
      } else {
        initializePlayer();
      }
    };

    const initializePlayer = () => {
      if (iframeRef.current && window.Stream) {
        try {
          // Initialize Stream player with the iframe
          playerRef.current = Stream(iframeRef.current);
          
          // Add event listeners for tracking
          addPlayerEventListeners();
          
          // Manually start time tracking since timeupdate events are unreliable
          startTimeTracking();
        } catch (error) {
          console.error('Error initializing Stream player:', error);
          onPlayerEvent('error', 'Failed to initialize player');
        }
      }
    };

    const addPlayerEventListeners = () => {
      if (!playerRef.current) return;
      
      // Standard video events
      playerRef.current.addEventListener('play', () => {
        onPlayerEvent('playing', playerRef.current);
      });
      
      playerRef.current.addEventListener('pause', () => {
        onPlayerEvent('pause', null);
      });
      
      playerRef.current.addEventListener('ended', () => {
        onPlayerEvent('ended', null);
      });
      
      playerRef.current.addEventListener('waiting', () => {
        onPlayerEvent('waiting', null);
      });
      
      playerRef.current.addEventListener('playing', () => {
        onPlayerEvent('playing', playerRef.current);
      });
      
      playerRef.current.addEventListener('canplay', () => {
        onPlayerEvent('canplay', null);
      });
      
      playerRef.current.addEventListener('loadedmetadata', () => {
        onPlayerEvent('playerReady', playerRef.current);
      });
      
      playerRef.current.addEventListener('error', (error) => {
        console.error('Player error:', error);
        onPlayerEvent('error', error || 'Video playback error');
      });
    };
    
    // Start a manual timer to track playback time since timeupdate events might not work reliably
    const startTimeTracking = () => {
      // Clear any existing interval
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      
      // Initialize last known time properties
      if (playerRef.current) {
        playerRef.current._lastKnownTime = 0;
        playerRef.current._lastCheckTime = Date.now();
      }
      
      // Set up a new interval (every 1000ms)
      timeUpdateIntervalRef.current = setInterval(() => {
        try {
          if (playerRef.current) {
            // Force currentTime to be read to ensure it's updated
            playerRef.current.currentTime;
            
            // Wait a moment and then check if it changed
            setTimeout(() => {
              if (!playerRef.current) return;
              
              const currentTime = playerRef.current.currentTime || 0;
              const isPaused = playerRef.current.paused;
              
              // Calculate time difference since last check
              const timeDiff = currentTime - (playerRef.current._lastKnownTime || 0);
              const realTimeElapsed = (Date.now() - playerRef.current._lastCheckTime) / 1000;
              
              // Determine if video is progressing (even if paused flag is true)
              const isTimeProgressing = timeDiff > 0.1 && realTimeElapsed > 0;
              
              // Force isPlaying to true if time is progressing
              const isPlaying = !isPaused || isTimeProgressing;
              
              // Always send the time update event
              onPlayerEvent('timeUpdate', {
                currentTime, 
                paused: isPaused,
                isPlaying,
                isTimeProgressing
              });
              
              // Update our tracking properties
              playerRef.current._lastKnownTime = currentTime;
              playerRef.current._lastCheckTime = Date.now();
            }, 200);
          }
        } catch (err) {
          console.error('Error in time tracking interval:', err);
        }
      }, 1000);
    };

    loadStreamSDK();

    return () => {
      // Clean up
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      playerRef.current = null;
    };
  }, [clip?.cloudflare_uid, onPlayerEvent]);

  if (!clip || !clip.cloudflare_uid) {
    return (
      <div className={styles.errorContainer}>
        Video data is not available.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={`https://iframe.cloudflarestream.com/${clip.cloudflare_uid}`}
      className={styles.iframeContainer}
      title={clip.title || 'Video Player'}
      
      allowFullScreen
    />
  );
};

export default DynamicVideoPlayer;