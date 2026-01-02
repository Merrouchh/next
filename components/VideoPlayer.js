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
  // Generate player ID once using useState with lazy initializer to avoid impure function in render
  const [playerId] = useState(() => `player_${clip?.id || Math.random().toString(36).substring(2)}`);
  const playerIdRef = useRef(playerId);
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
  const wasPlayingBeforeSeekRef = useRef(false); // Track if video was playing before seek

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
        // Wait for container to have proper dimensions (important for client-side navigation)
        const checkContainerSize = () => {
          // Check the videoWrapper container (parent of data-vjs-player)
          const wrapper = videoElementRef.current?.parentElement?.parentElement;
          if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/a05d6a1c-7523-4326-8d61-7bfc627de1aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.js:62',message:'Checking container dimensions',data:{clipId:clip.id,wrapperWidth:rect.width,wrapperHeight:rect.height,hasSize:rect.width>0&&rect.height>0},sessionId:'debug-session',runId:'run1',hypothesisId:'I'}),timestamp:Date.now()}).catch(()=>{});
            // #endregion
            return rect.width > 0 && rect.height > 0;
          }
          return false;
        };

        // If container doesn't have size yet, wait for layout (client-side navigation case)
        let attempts = 0;
        const maxAttempts = 10;
        while (!checkContainerSize() && attempts < maxAttempts) {
          // Wait for next animation frame to ensure layout is complete
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          console.warn(`Container still has no dimensions after ${maxAttempts} attempts, proceeding anyway`);
        }

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
        wasPlayingBeforeSeekRef.current = false; // Reset seek tracking

        // Clean up previous player instance
        if (playerRef.current) {
          playerRef.current.dispose();
          playerRef.current = null;
        }

        // Update player ID when clip changes - use clip ID or timestamp for uniqueness
        playerIdRef.current = `player_${clip.id || `temp_${Date.now()}`}`;

        // Generate thumbnail URL with fallback to cloudflare_uid if thumbnail_path is missing
        let thumbnailUrl = clip.thumbnail_path || clip.thumbnail_url || '';
        if (!thumbnailUrl && clip.cloudflare_uid) {
          thumbnailUrl = `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/a05d6a1c-7523-4326-8d61-7bfc627de1aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.js:96',message:'VideoPlayer thumbnail URL',data:{clipId:clip.id,thumbnail_path:clip.thumbnail_path,thumbnail_url:clip.thumbnail_url,cloudflare_uid:clip.cloudflare_uid,generatedThumbnailUrl:thumbnailUrl},sessionId:'debug-session',runId:'run1',hypothesisId:'G'}),timestamp:Date.now()}).catch(()=>{});
        // #endregion

        // Initialize Video.js with minimal loading
        console.log('Initializing Video.js player for clip:', clip.id);
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
          poster: thumbnailUrl, // Use generated thumbnail URL
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
            playerEl.style.width = '100%';
            playerEl.style.height = '100%';
            playerEl.style.position = 'absolute';
            playerEl.style.top = '0';
            playerEl.style.left = '0';
            
            // Ensure video element stays contained
            const videoEl = playerEl.querySelector('video');
            if (videoEl) {
              videoEl.style.objectFit = isInClipCard ? 'cover' : 'contain';
              videoEl.style.maxWidth = '100%';
              videoEl.style.maxHeight = '100%';
              videoEl.style.width = '100%';
              videoEl.style.height = '100%';
              videoEl.style.display = 'block';
            }
            
            // Ensure vjs-tech element is visible
            const techEl = playerEl.querySelector('.vjs-tech');
            if (techEl) {
              techEl.style.width = '100%';
              techEl.style.height = '100%';
              techEl.style.display = 'block';
            }
          }
        };

        // Apply theme class
        const playerEl = player.el();
        if (playerEl) {
          playerEl.classList.add('vjs-theme-merrouch');
        }
        
        // Apply containment immediately
        containVideo();

        // Set video source with multiple types for better compatibility
        const setVideoSource = () => {
          // Extract the file extension from the mp4link URL
          const fileExtension = clip.mp4link.split('.').pop().toLowerCase();
          const mimeType = getMimeType(fileExtension);
          
          // Generate thumbnail URL for source
          let sourceThumbnailUrl = clip.thumbnail_path || clip.thumbnail_url || '';
          if (!sourceThumbnailUrl && clip.cloudflare_uid) {
            sourceThumbnailUrl = `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`;
          }
          
          // Set main source
          player.src({
            type: mimeType,
            src: clip.mp4link,
            poster: sourceThumbnailUrl
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
        
        // Explicitly set the poster after source is set to ensure it updates
        if (thumbnailUrl) {
          player.poster(thumbnailUrl);
        }
        
        console.log('Video.js player created and source set:', {
          playerId: playerIdRef.current,
          player: !!player,
          readyState: player.readyState(),
          paused: player.paused(),
          src: player.src(),
          clipId: clip.id,
          mp4link: clip.mp4link,
          poster: player.poster()
        });

        // Event handlers
        player.on('play', () => {
          console.log(`Video playing: ${playerIdRef.current}`);
          setIsActuallyPlaying(true);
          setIsBuffering(false);
          setError(null);
          setShowCustomPlayButton(false);
          
          // Ensure video is visible when playing (fix for client-side navigation)
          requestAnimationFrame(() => {
            containVideo();
            const playerEl = player.el();
            if (playerEl) {
              const videoEl = playerEl.querySelector('video');
              if (videoEl) {
                // #region agent log
                const rect = videoEl.getBoundingClientRect();
                fetch('http://127.0.0.1:7243/ingest/a05d6a1c-7523-4326-8d61-7bfc627de1aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.js:215',message:'Video play event - checking dimensions',data:{clipId:clip.id,videoWidth:rect.width,videoHeight:rect.height},sessionId:'debug-session',runId:'run1',hypothesisId:'H'}),timestamp:Date.now()}).catch(()=>{});
                // #endregion
                
                videoEl.style.width = '100%';
                videoEl.style.height = '100%';
                videoEl.style.display = 'block';
                videoEl.style.visibility = 'visible';
                videoEl.style.opacity = '1';
              }
            }
          });
          
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

        // Ensure poster is set when player is ready
        player.on('loadedmetadata', () => {
          if (thumbnailUrl && player.poster() !== thumbnailUrl) {
            console.log(`Updating poster for player ${playerIdRef.current} to:`, thumbnailUrl);
            player.poster(thumbnailUrl);
          }
          // Ensure video is properly sized when metadata loads
          containVideo();
        });
        
        // Ensure video is visible when player is ready
        player.ready(() => {
          console.log(`Player ${playerIdRef.current} is ready, ensuring visibility`);
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            containVideo();
            const playerElement = player.el();
            if (playerElement) {
              const rect = playerElement.getBoundingClientRect();
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/a05d6a1c-7523-4326-8d61-7bfc627de1aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.js:318',message:'Player ready - checking dimensions',data:{clipId:clip.id,playerWidth:rect.width,playerHeight:rect.height},sessionId:'debug-session',runId:'run1',hypothesisId:'H'}),timestamp:Date.now()}).catch(()=>{});
              // #endregion
              
              playerElement.style.width = '100%';
              playerElement.style.height = '100%';
              
              // Force video element to be visible
              const videoEl = playerElement.querySelector('video');
              if (videoEl) {
                const videoRect = videoEl.getBoundingClientRect();
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/a05d6a1c-7523-4326-8d61-7bfc627de1aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.js:329',message:'Video element dimensions',data:{clipId:clip.id,videoWidth:videoRect.width,videoHeight:videoRect.height,videoDisplay:window.getComputedStyle(videoEl).display},sessionId:'debug-session',runId:'run1',hypothesisId:'H'}),timestamp:Date.now()}).catch(()=>{});
                // #endregion
                
                videoEl.style.width = '100%';
                videoEl.style.height = '100%';
                videoEl.style.display = 'block';
                videoEl.style.visibility = 'visible';
                videoEl.style.opacity = '1';
                videoEl.style.position = 'absolute';
                videoEl.style.top = '0';
                videoEl.style.left = '0';
              }
              
              // Force tech element to be visible
              const techEl = playerElement.querySelector('.vjs-tech');
              if (techEl) {
                const techRect = techEl.getBoundingClientRect();
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/a05d6a1c-7523-4326-8d61-7bfc627de1aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoPlayer.js:345',message:'Tech element dimensions',data:{clipId:clip.id,techWidth:techRect.width,techHeight:techRect.height,techDisplay:window.getComputedStyle(techEl).display},sessionId:'debug-session',runId:'run1',hypothesisId:'H'}),timestamp:Date.now()}).catch(()=>{});
                // #endregion
                
                techEl.style.width = '100%';
                techEl.style.height = '100%';
                techEl.style.display = 'block';
                techEl.style.visibility = 'visible';
                techEl.style.opacity = '1';
              }
            }
          });
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
          
          // Track if video was playing before seek started
          wasPlayingBeforeSeekRef.current = !player.paused();
          
          // Show controls during seeking
          player.userActive(true);
          
          // Set buffering state when seeking starts
          setIsBuffering(true);
          onLoadingChange?.(true);
        });

        player.on('seeked', () => {
          // When seeking is complete, update timestamp and clear buffering
          lastTimestamp = player.currentTime();
          setIsBuffering(false);
          onLoadingChange?.(false);
          
          // If video was playing before seeking, resume playback
          if (wasPlayingBeforeSeekRef.current && player.paused()) {
            console.log('Resuming playback after seek');
            player.play().catch(err => {
              console.error('Error resuming playback after seek:', err);
              // If play fails, update state
              setIsActuallyPlaying(false);
              setShowCustomPlayButton(true);
              wasPlayingBeforeSeekRef.current = false;
            });
          } else {
            // Reset the ref
            wasPlayingBeforeSeekRef.current = false;
          }
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

        player.on('error', () => {
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
        
        // Force resize after delays to ensure container has dimensions (client-side navigation fix)
        // Multiple timeouts to catch different timing scenarios
        setTimeout(() => {
          containVideo();
          try {
            player.trigger('resize');
          } catch (e) {
            console.log('Resize trigger failed (may be normal):', e);
          }
        }, 100);
        
        setTimeout(() => {
          containVideo();
          try {
            player.trigger('resize');
          } catch (e) {
            console.log('Second resize trigger failed (may be normal):', e);
          }
        }, 500);
        
        // Also trigger resize on window load/resize events (client-side navigation)
        const handleResize = () => {
          containVideo();
          try {
            player.trigger('resize');
          } catch {
            // Ignore errors
          }
        };
        
        window.addEventListener('resize', handleResize);
        const loadHandler = () => {
          setTimeout(handleResize, 100);
        };
        if (document.readyState === 'complete') {
          // If document already loaded, trigger resize immediately
          setTimeout(handleResize, 100);
        } else {
          window.addEventListener('load', loadHandler);
        }
        
        player.on('loadedmetadata', containVideo);
        player.on('resize', containVideo);

        // Return cleanup function that will properly dispose the player when unmounted
        return () => {
          // Clean up resize handlers
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('load', loadHandler);
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
      
      // Check if player is currently playing before disposing
      if (playerRef.current && !playerRef.current.paused()) {
        console.log(`Player ${playerIdRef.current} is currently playing, pausing before cleanup`);
        try {
          playerRef.current.pause();
        } catch (pauseError) {
          console.error('Error pausing player during cleanup:', pauseError);
        }
      }
      
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
  }, [clip?.id, clip?.mp4link, clip?.thumbnail_path, clip?.thumbnail_url, clip?.cloudflare_uid, mounted, isInClipCard, onLoadingChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle custom play button click - starts preloading and plays
  const handleCustomPlayButtonClick = () => {
    console.log('Custom play button clicked!', {
      playerRef: !!playerRef.current,
      playerId: playerIdRef.current,
      clipId: clip?.id,
      mp4link: clip?.mp4link,
      videoInitialized
    });
    
    if (playerRef.current) {
      // Start preloading if not already done
      if (!videoInitialized) {
        console.log(`Starting preload from button click: ${playerIdRef.current}`);
        playerRef.current.preload('auto');
        setVideoInitialized(true);
      }
      
      // Play the video
      console.log('Attempting to play video...');
      const playPromise = playerRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('Video play promise resolved successfully');
        }).catch(error => {
          // Ignore benign AbortError caused by immediate pause/dispose during re-init
          if (error && (error.name === 'AbortError' || (typeof error.message === 'string' && error.message.includes('AbortError')))) {
            console.warn('Play aborted (likely due to pause/dispose during init). Ignoring.');
            return;
          }
          console.error('Video play promise rejected:', error);
          setError(`Playback failed: ${error.message}`);
        });
      }
    } else {
      console.error('Player reference is null - cannot play video');
      setError('Video player not initialized');
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
  }, [playbackTime, hasTrackedView, clip?.id, user?.id, isActuallyPlaying, isBuffering, isFullscreen, user]);

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
  }, [isFullscreen, hasTrackedView, clip?.id, user?.id, user]);

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
          poster={clip.thumbnail_path || clip.thumbnail_url || (clip.cloudflare_uid ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg` : '')}
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