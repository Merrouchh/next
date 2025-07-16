import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import styles from '../styles/VideoPlayer.module.css';
import { trackView } from '../utils/viewTracking';
import videoPlayerManager from '../utils/videoPlayerManager';
import { loadVideoScripts } from '../utils/videoScriptLoader';

const MINIMUM_VIEW_SECONDS = 5; // Centralized constant for view threshold
const CONTROL_FADE_TIMEOUT = 2000; // Timeout in ms for controls to fade

const VideoPlayer = ({ clip, user, onLoadingChange, isInClipCard }) => {
  const videoElementRef = useRef(null);
  const playerRef = useRef(null);
  const playerIdRef = useRef(`player_${clip?.id || Math.random().toString(36).substring(2)}`);
  const [error, setError] = useState(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showCustomPlayButton, setShowCustomPlayButton] = useState(true);
  const [videoInitialized, setVideoInitialized] = useState(false);
  const anonymousIdRef = useRef(null);
  const trackingAttemptedRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);
  const actualPlaybackTimeRef = useRef(0); // Accurate tracking of actual playback time
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pendingViewTrackingRef = useRef(false); // Track if view tracking is pending

  // Set mounted state
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Setup anonymous viewer ID
  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      let anonId = localStorage.getItem('anonymousViewerId');
      if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('anonymousViewerId', anonId);
      }
      anonymousIdRef.current = anonId;
    }
  }, [user]);

  // Initialize video player
  useEffect(() => {
    if (!mounted || !videoElementRef.current || !clip?.mp4link) return;

    const initializePlayer = async () => {
      try {
        // Load video scripts conditionally to prevent critical request chain
        await loadVideoScripts();

        // Reset state when clip changes
        setHasTrackedView(false);
        setPlaybackTime(0);
        setIsActuallyPlaying(false);
        setError(null);
        setShowCustomPlayButton(true);
        setVideoInitialized(false);
        trackingAttemptedRef.current = false;
        lastTimeUpdateRef.current = 0;
        actualPlaybackTimeRef.current = 0; // Reset the accurate playback counter

        // Clean up previous player instance
        if (playerRef.current) {
          playerRef.current.dispose();
          playerRef.current = null;
        }

        // Update player ID when clip changes
        playerIdRef.current = `player_${clip.id || Math.random().toString(36).substring(2)}`;

        // Initialize Video.js with minimal loading
        const player = videojs(videoElementRef.current, {
          controls: true,
          autoplay: false,
          preload: 'none', // Start with no preloading
          fluid: true,
          responsive: true,
          fill: true, // Fill available space without overflow
          aspectRatio: '16:9', // Maintain aspect ratio
          playbackRates: [0.5, 1, 1.5, 2],
          bigPlayButton: false, // Using our custom play button
          poster: clip.thumbnail_path || '', // Use thumbnail as poster
          userActions: {
            hotkeys: true, // Enable keyboard controls
            doubleClick: true // Enable double-click to fullscreen
          },
          html5: {
            vhs: {
              overrideNative: true // Force HTML5 even for complex formats
            },
            nativeAudioTracks: false,
            nativeVideoTracks: false
          },
          controlBar: {
            children: [
              'playToggle',
              'volumePanel',
              'currentTimeDisplay',
              'timeDivider',
              'durationDisplay',
              'progressControl',
              'playbackRateMenuButton',
              'fullscreenToggle'
            ],
            // Allow control bar to fade out after inactivity
            fadeTime: 1000, // Fade duration - 1 second
            autoHide: true // Enable auto-hiding
          },
          // Set inactive timeout to 2 seconds (default is 3000ms)
          inactivityTimeout: CONTROL_FADE_TIMEOUT
        });

        // Apply containment styles
        const containVideo = () => {
          // Ensure player element stays contained
          const playerEl = player.el();
          if (playerEl) {
            playerEl.style.maxWidth = '100%';
            playerEl.style.maxHeight = '100%';
            playerEl.style.overflow = 'hidden';
            
            // Ensure video element stays contained
            const videoEl = playerEl.querySelector('video');
            if (videoEl) {
              videoEl.style.objectFit = isInClipCard ? 'cover' : 'contain';
              videoEl.style.maxWidth = '100%';
              videoEl.style.maxHeight = '100%';
            }
          }
        };

        // Apply theme class
        const playerEl = player.el();
        if (playerEl) {
          playerEl.classList.add('vjs-theme-merrouch');
        }

        // Set video source with multiple types for better compatibility
        const setVideoSource = () => {
          // Extract the file extension from the mp4link URL
          const fileExtension = clip.mp4link.split('.').pop().toLowerCase();
          const mimeType = getMimeType(fileExtension);
          
          // Set main source
          player.src({
            type: mimeType,
            src: clip.mp4link,
            poster: clip.thumbnail_path || ''
          });
        };

        // Helper to get proper MIME type based on file extension
        const getMimeType = (ext) => {
          const mimeMap = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogv': 'video/ogg',
            'mov': 'video/quicktime',
            'm4v': 'video/mp4',
            'ts': 'video/mp2t',
            'm3u8': 'application/x-mpegURL'
          };
          return mimeMap[ext] || 'video/mp4'; // Default to mp4 if unknown
        };

        // Set the source
        setVideoSource();

        // Event handlers
        player.on('play', () => {
          console.log(`Video playing: ${playerIdRef.current}`);
          setIsActuallyPlaying(true);
          setIsBuffering(false);
          setError(null);
          setShowCustomPlayButton(false);
          
          // Start preloading if not already initialized
          if (!videoInitialized) {
            console.log(`Starting preload for: ${playerIdRef.current}`);
            player.preload('auto');
            setVideoInitialized(true);
          }
          
          // Add debugging info about player state
          try {
            console.log(`Player state on play: isPlaying=${!player.paused()}, playerId=${playerIdRef.current}, clipId=${clip.id}`);
          } catch (e) {
            console.error('Error logging player state:', e);
          }
          
          // Notify the video manager that this player has started playing
          // This will pause all other players
          console.log(`Notifying video manager that ${playerIdRef.current} has started playing`);
          videoPlayerManager.playerStartedPlaying(playerIdRef.current);
        });

        player.on('pause', () => {
          console.log(`Video paused: ${playerIdRef.current}`);
          setIsActuallyPlaying(false);
          setShowCustomPlayButton(true);
          
          // Update the video player manager if this was the currently playing video
          if (videoPlayerManager.currentlyPlayingId === playerIdRef.current) {
            console.log(`Clearing current playing ID in manager: ${playerIdRef.current}`);
            videoPlayerManager.currentlyPlayingId = null;
          }
          
          // Show controls when paused
          player.userActive(true);
        });

        player.on('ended', () => {
          setIsActuallyPlaying(false);
          setShowCustomPlayButton(true);
          
          // Show controls when ended
          player.userActive(true);
        });

        // More precise timeupdate handling
        let lastTimestamp = 0;
        player.on('timeupdate', () => {
          const currentTime = player.currentTime();
          
          // Only count playback time when actually progressing forward
          if (currentTime > lastTimestamp) {
            // Calculate actual time difference
            const timeDiff = currentTime - lastTimestamp;
            
            // Increment by the actual time difference (capped at 1 second to avoid jumps)
            const increment = Math.min(timeDiff, 1);
            
            // Update our accurate playback counter
            actualPlaybackTimeRef.current += increment;
            
            // Debug logging at whole second intervals
            if (Math.floor(actualPlaybackTimeRef.current) > Math.floor(actualPlaybackTimeRef.current - increment)) {
              console.log(`Actual playback time: ${Math.floor(actualPlaybackTimeRef.current)} seconds`);
            }
            
            // Also update the old counter for backward compatibility
            setPlaybackTime(Math.floor(actualPlaybackTimeRef.current));
          }
          
          lastTimestamp = currentTime;
        });

        player.on('seeking', () => {
          // When user seeks, update the last timestamp to prevent counting the jump
          lastTimestamp = player.currentTime();
          
          // Show controls during seeking
          player.userActive(true);
        });

        player.on('waiting', () => {
          console.log('Video buffering');
          setIsBuffering(true);
          onLoadingChange?.(true);
        });

        player.on('canplay', () => {
          console.log('Video can play');
          setIsBuffering(false);
          onLoadingChange?.(false);
        });

        player.on('error', (e) => {
          const error = player.error();
          console.error('Video.js Error:', error);
          
          // Try to recover from error by setting source again
          if (player.error().code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
            console.log('Attempting to recover from format error...');
            setTimeout(() => {
              try {
                setVideoSource();
                player.load();
              } catch (recoveryError) {
                console.error('Recovery failed:', recoveryError);
                setError('Failed to load video');
              }
            }, 1000);
          } else {
            setError('Failed to load video');
          }
        });

        player.on('fullscreenchange', () => {
          // Update fullscreen state
          const isInFullscreen = player.isFullscreen();
          setIsFullscreen(isInFullscreen);
          
          // When exiting fullscreen, ensure containment
          if (!isInFullscreen) {
            setTimeout(containVideo, 100);
          }
        });

        // Store player reference
        playerRef.current = player;

        // Register this player with the video manager
        const unregisterPlayer = videoPlayerManager.registerPlayer(playerIdRef.current, player);

        // Apply containment styles on initialization and events
        containVideo();
        player.on('loadedmetadata', containVideo);
        player.on('resize', containVideo);

        // Return cleanup function that will properly dispose the player when unmounted
        return () => {
          try {
            // First, call the unregister function returned from video player manager
            unregisterPlayer();
            
            // Safety check if player has been disposed or has invalid tech
            if (!player || player.isDisposed_ || 
                (typeof player.isDisposed === 'function' && player.isDisposed())) {
              console.log(`Player ${playerIdRef.current} already disposed in inner cleanup`);
              return;
            }
            
            // Make sure the player is paused before disposal
            try {
              if (player && typeof player.pause === 'function') {
                // Try to pause without checking paused state first
                console.log(`Pausing player ${playerIdRef.current} on inner cleanup`);
                player.pause();
              }
            } catch (e) {
              console.error(`Error pausing player ${playerIdRef.current} on inner cleanup:`, e);
              // Continue even if pause fails
            }
          } catch (error) {
            console.error(`Error in inner cleanup for player ${playerIdRef.current}:`, error);
          }
        };
      } catch (error) {
        console.error('Error initializing video player:', error);
        setError('Failed to initialize video player');
        return () => {};
      }
    };

    // Initialize player with async script loading
    initializePlayer();

    // Cleanup on unmount
    return () => {
      // Clear any pending timeouts
      
      // Log that we're cleaning up
      console.log(`Cleaning up player: ${playerIdRef.current}`);
      
      // Unregister from video player manager first
      try {
        // If this is the currently playing video, clear that reference
        if (videoPlayerManager.currentlyPlayingId === playerIdRef.current) {
          console.log(`Clearing current playing ID in manager on unmount: ${playerIdRef.current}`);
          videoPlayerManager.currentlyPlayingId = null;
        }
        
        // Remove the player from the active players without trying to pause all
        // This avoids the error when navigating between pages
        const playerToRemove = playerIdRef.current;
        if (videoPlayerManager.activePlayers.has(playerToRemove)) {
          console.log(`Manually removing player ${playerToRemove} from manager`);
          videoPlayerManager.activePlayers.delete(playerToRemove);
        }
      } catch (err) {
        console.error('Error updating video player manager:', err);
      }
      
      // Dispose of the player - with additional safety
      if (playerRef.current) {
        try {
          const player = playerRef.current;
          
          // Check if player is already being disposed or is disposed
          if (player.isDisposed_ || (typeof player.isDisposed === 'function' && player.isDisposed())) {
            console.log(`Player ${playerIdRef.current} is already disposed`);
            playerRef.current = null;
            return;
          }
          
          // Try to pause the video safely
          if (typeof player.pause === 'function') {
            try {
              // Extra safety checks for tech element
              if (player.tech && player.tech_ && player.tech_.el_) {
                console.log(`Pausing player ${playerIdRef.current} with valid tech`);
                player.pause();
              }
            } catch (pauseErr) {
              console.error(`Error pausing player ${playerIdRef.current}:`, pauseErr);
            }
          }
          
          // Dispose the player
          console.log(`Disposing player: ${playerIdRef.current}`);
          player.dispose();
          playerRef.current = null;
        } catch (disposeErr) {
          console.error(`Error disposing player ${playerIdRef.current}:`, disposeErr);
          playerRef.current = null;
        }
      }
    };
  }, [clip?.id, clip?.mp4link, mounted, isInClipCard]);

  // Handle custom play button click - starts preloading and plays
  const handleCustomPlayButtonClick = () => {
    if (playerRef.current) {
      // Start preloading if not already done
      if (!videoInitialized) {
        console.log(`Starting preload from button click: ${playerIdRef.current}`);
        playerRef.current.preload('auto');
        setVideoInitialized(true);
      }
      
      // Play the video
      playerRef.current.play();
    }
  };

  // Track views after a minimum viewing time has been reached
  useEffect(() => {
    if (!clip?.id || hasTrackedView || !isActuallyPlaying || isBuffering) {
      return;
    }

    // Use our accurate playback counter with explicit threshold
    if (actualPlaybackTimeRef.current >= MINIMUM_VIEW_SECONDS) {
      console.log(`View threshold reached: ${actualPlaybackTimeRef.current.toFixed(1)} seconds`);
      
      // Only attempt once per session
      if (!trackingAttemptedRef.current) {
        trackingAttemptedRef.current = true;
        
        const trackViewAsync = async () => {
          try {
            // Skip view tracking when in fullscreen mode to prevent browser issues
            // (particularly in Brave browser where it causes fullscreen exit)
            if (isFullscreen) {
              console.log('[View Tracking] Currently in fullscreen mode, marking view tracking as pending');
              pendingViewTrackingRef.current = true;
              return; // Exit without tracking
            }
            
            // Clear pending flag if we're tracking now
            pendingViewTrackingRef.current = false;
            
            // Track the view
            console.log(`[View Tracking] Tracking view for clip ${clip.id}`);
            const viewerId = user?.id || anonymousIdRef.current;
            if (viewerId) {
              const viewCount = await trackView(clip.id, viewerId, !user);
              if (viewCount !== null) {
                console.log(`View tracked successfully, count: ${viewCount}`);
                setHasTrackedView(true);
              }
            }
          } catch (err) {
            console.error('Error tracking view:', err);
            trackingAttemptedRef.current = false;
          }
        };
        
        trackViewAsync();
      }
    }
  }, [playbackTime, hasTrackedView, clip?.id, user?.id, isActuallyPlaying, isBuffering, isFullscreen]);

  // Handle pending view tracking when exiting fullscreen
  useEffect(() => {
    // If we're no longer in fullscreen and have pending tracking
    if (!isFullscreen && pendingViewTrackingRef.current && !hasTrackedView) {
      console.log('[View Tracking] Exited fullscreen with pending view tracking, executing now');
      
      const executeTrackingAfterFullscreen = async () => {
        try {
          // Small delay to ensure fullscreen exit is completely finished
          // This prevents issues with Brave browser's fullscreen API
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Reset pending flag
          pendingViewTrackingRef.current = false;
          
          // Now safe to track the view
          console.log(`[View Tracking] Executing pending tracking for clip ${clip?.id}`);
          const viewerId = user?.id || anonymousIdRef.current;
          if (viewerId && clip?.id) {
            const viewCount = await trackView(clip.id, viewerId, !user);
            if (viewCount !== null) {
              console.log(`View tracked successfully, count: ${viewCount}`);
              setHasTrackedView(true);
            }
          }
        } catch (err) {
          console.error('[View Tracking] Error in delayed tracking after fullscreen:', err);
          // Reset tracking flag to allow retrying
          trackingAttemptedRef.current = false;
        }
      };
      
      executeTrackingAfterFullscreen();
    }
  }, [isFullscreen, hasTrackedView, clip?.id, user?.id]);

  // Handle missing clip data
  if (!clip) {
    return <div className={styles.errorContainer}>No clip data provided.</div>;
  }

  if (!clip.mp4link) {
    return <div className={styles.errorContainer}>Video source not available.</div>;
  }

  return (
    <div className={`${styles.videoWrapper} ${isInClipCard ? styles.inClipCard : ''} ${styles.videoPlayerTheme}`}>
      {/* Video.js container with overflow:hidden */}
      <div data-vjs-player style={{ overflow: 'hidden' }}>
        <video
          ref={videoElementRef}
          className="video-js"
          playsInline
          preload="none" 
          poster={clip.thumbnail_path || ''}
          data-player-id={playerIdRef.current}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          <source src={clip.mp4link} type="video/mp4" />
          <p className="vjs-no-js">
            To view this video please enable JavaScript, and consider upgrading to a
            web browser that supports HTML5 video
          </p>
        </video>
      </div>
      
      {/* Custom play button overlay */}
      {showCustomPlayButton && (
        <div 
          className={styles.customPlayButton}
          onClick={handleCustomPlayButtonClick}
          aria-label="Play video"
        >
          <div className={styles.playIcon}></div>
        </div>
      )}
      
      {/* Error message overlay */}
      {error && (
        <div className={styles.errorOverlay}>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => {
              setError(null);
              if (playerRef.current) {
                playerRef.current.load();
              }
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;