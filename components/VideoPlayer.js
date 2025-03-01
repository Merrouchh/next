import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/http-streaming';
import styles from '../styles/VideoPlayer.module.css';
import { trackView } from '../utils/viewTracking';
import { useVideo } from '../contexts/VideoContext';
import { MdClose } from 'react-icons/md';

// Custom HD/Stats Button Component
const registerStatsButton = () => {
if (!videojs.getComponent('StatsButton')) {
  const Button = videojs.getComponent('Button');
  class StatsButton extends Button {
    constructor(player, options) {
      super(player, options);
      this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
      if (this.options_.onStatsClick) {
        this.options_.onStatsClick();
      }
    }

    buildCSSClass() {
      return `vjs-stats-button ${super.buildCSSClass()}`;
    }

    createEl() {
        const el = super.createEl('button', {
          className: 'vjs-stats-button vjs-control vjs-button',
          title: 'Video Stats'
        });
        
        // Create a completely custom inner element
        const innerSpan = document.createElement('span');
        innerSpan.className = 'vjs-icon-placeholder';
        innerSpan.innerHTML = 'HD';
        innerSpan.style.fontFamily = 'Arial, sans-serif';
        innerSpan.style.fontSize = '14px';
        innerSpan.style.fontWeight = 'bold';
        innerSpan.style.backgroundColor = '#ffd700';
        innerSpan.style.padding = '2px 6px';
        innerSpan.style.borderRadius = '3px';
        innerSpan.style.color = '#000';
        innerSpan.style.display = 'flex';
        innerSpan.style.alignItems = 'center';
        innerSpan.style.justifyContent = 'center';
        
        // Clear any existing content and append our custom element
        el.innerHTML = '';
        el.appendChild(innerSpan);
        
        return el;
    }
  }
  videojs.registerComponent('StatsButton', StatsButton);
    console.log('StatsButton component registered');
}
};

// Register the button component once
registerStatsButton();

const VideoPlayer = ({ clip, user, onLoadingChange }) => {
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const playbackTimerRef = useRef(null);
  const anonymousIdRef = useRef(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const wrapperRef = useRef(null);
  const trackingAttemptedRef = useRef(false);
  const timeoutIdsRef = useRef([]); // Reference to store timeout IDs for cleanup
  const { registerPlayer, unregisterPlayer, pauseOthers } = useVideo();
  const [error, setError] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [isSmallPlayer, setIsSmallPlayer] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [videoStats, setVideoStats] = useState({
    currentQuality: 'Loading...',
    resolution: '',
    bandwidth: 0,
    availableQualities: [],
    currentTime: 0,
    duration: 0,
    buffered: 0,
    playerState: 'Initializing'
  });
  const [isBufferingForQuality, setIsBufferingForQuality] = useState(false);
  const [hasBufferedHighQuality, setHasBufferedHighQuality] = useState(false);
  const initialPlayAttemptRef = useRef(false);

  // Detect if user is on a mobile device
  useEffect(() => {
    const detectMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      console.log('Device detection:', { userAgent, isMobile });
      setIsMobileDevice(isMobile);
    };
    
    detectMobile();
  }, []);

  // Helper function to safely set timeouts that will be cleaned up
  const safeSetTimeout = (callback, delay) => {
    const id = setTimeout(() => {
      // Remove this timeout ID from the array when it executes
      timeoutIdsRef.current = timeoutIdsRef.current.filter(timeoutId => timeoutId !== id);
      callback();
    }, delay);
    
    // Store the timeout ID for potential cleanup
    timeoutIdsRef.current.push(id);
    return id;
  };

  // Add a function to update player UI based on size
  const updatePlayerUIForSize = (player, isSmall) => {
    if (!player) return;
    
    try {
      const controlBar = player.getChild('controlBar');
      if (controlBar) {
        const volumePanel = controlBar.getChild('volumePanel');
        if (volumePanel) {
          if (isSmall) {
            volumePanel.hide();
            console.log('Volume panel hidden due to small player size');
          } else {
            volumePanel.show();
            console.log('Volume panel shown due to larger player size');
          }
        }
      }
    } catch (err) {
      console.warn('Error updating player UI for size:', err);
    }
  };

  // Update the resize effect to use this function
  useEffect(() => {
    const checkPlayerSize = () => {
      if (wrapperRef.current) {
        const { width, height } = wrapperRef.current.getBoundingClientRect();
        const isSmall = width < 640 || height < 400;
        setIsSmallPlayer(isSmall);
        console.log(`Player size: ${width}x${height}, isSmall: ${isSmall}`);
        
        // Update player UI when size changes
        if (playerRef.current) {
          updatePlayerUIForSize(playerRef.current, isSmall);
        }
      }
    };

    // Check size initially
    checkPlayerSize();

    // Add resize listener
    window.addEventListener('resize', checkPlayerSize);

    // Clean up
    return () => {
      window.removeEventListener('resize', checkPlayerSize);
    };
  }, []);

  // Reset tracking state when clip changes
  useEffect(() => {
    console.log('Clip changed, resetting tracking state for clip:', clip?.id);
    setHasTrackedView(false);
    setPlaybackTime(0);
    setIsActuallyPlaying(false);
    setHasBufferedHighQuality(false);
    initialPlayAttemptRef.current = false;
    trackingAttemptedRef.current = false;
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, [clip?.id]);

  // Generate or retrieve anonymous ID for non-logged-in users
  useEffect(() => {
    if (!user) {
      let anonId = localStorage.getItem('anonymousViewerId');
      if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('anonymousViewerId', anonId);
      }
      anonymousIdRef.current = anonId;
      console.log('Using anonymous ID:', anonId);
    }
  }, [user]);

  // Handle actual playback tracking
  const startPlaybackTracking = () => {
    console.log('Starting playback tracking');
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }

    playbackTimerRef.current = setInterval(() => {
      if (playerRef.current && !playerRef.current.paused() && !isBuffering) {
          const currentTime = playerRef.current.currentTime();
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

  // Clean up player on unmount or clip change
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
          unregisterPlayer(clip?.id);
        } catch (err) {
          console.warn('Error disposing player:', err);
        }
        playerRef.current = null;
      }
      stopPlaybackTracking();
    };
  }, [clip?.id]);

  // Move handleQualityChange outside useEffect
  const handleQualityChange = (selectedQuality) => {
    if (!playerRef.current) return;
    
    try {
      const tech = playerRef.current.tech({ IWillNotUseThisInPlugins: true });
      if (!tech || !tech.vhs) {
        console.warn('VHS tech not available for quality change');
        return;
      }
      
      console.log('Changing quality to:', selectedQuality.height + 'p');
      
      // Store current time and playing state
      const currentTime = playerRef.current.currentTime();
      const wasPlaying = !playerRef.current.paused();
      const currentVolume = playerRef.current.volume();
      const wasMuted = playerRef.current.muted();
      
      // Get representations safely
      const representations = tech.vhs.representations();
      if (!representations || !representations.length) {
        console.warn('No representations available for quality change');
        return;
      }
      
      // Disable all qualities first
      representations.forEach(rep => {
        try {
          if (typeof rep.enabled === 'function') {
            rep.enabled(false);
          }
        } catch (err) {
          console.warn('Error disabling representation:', err);
        }
      });
      
      // Enable only the selected quality
      const selectedRep = representations.find(rep => rep.id === selectedQuality.id);
      if (selectedRep && typeof selectedRep.enabled === 'function') {
        selectedRep.enabled(true);
        
        // Update stats immediately
              setVideoStats(prev => ({
                ...prev,
          currentQuality: `${selectedRep.height}p`,
          resolution: `${selectedRep.width}x${selectedRep.height}`,
          bandwidth: Math.round(selectedRep.bandwidth / 1000) + ' Kbps'
        }));
        
        // Set bandwidth to match the selected quality
        if (tech.vhs.masterPlaylistController_ && 
            tech.vhs.masterPlaylistController_.mainSegmentLoader_) {
          tech.vhs.masterPlaylistController_.mainSegmentLoader_.bandwidth = selectedRep.bandwidth * 1.5;
          console.log('Set bandwidth for quality change:', selectedRep.bandwidth * 1.5);
        }
      } else {
        console.warn('Selected representation not found or cannot be enabled');
      }
      
      // Restore position, play state, and audio settings
      safeSetTimeout(() => {
        if (playerRef.current) {
          try {
            // Restore position
            playerRef.current.currentTime(currentTime);
            
            // Restore audio settings
            playerRef.current.volume(currentVolume);
            playerRef.current.muted(wasMuted);
            
            // Trigger audio initialization to ensure audio works
            const event = new CustomEvent('qualitychange');
            playerRef.current.trigger(event);
            
            // Restore play state
            if (wasPlaying) {
              playerRef.current.play().catch(err => {
                console.warn('Error resuming playback after quality change:', err);
          });
        }
      } catch (err) {
            console.warn('Error restoring state after quality change:', err);
        }
      }
      }, 100);
    } catch (err) {
      console.warn('Quality change error:', err);
    }
  };

  const getHighestQualityStream = async (id) => {
    try {
      const url = `https://videodelivery.net/${id}`;
      const res = await fetch(`${url}/manifest/video.m3u8`);
      const streamText = await res.text();
      
      // Find all quality streams
      const streams = [...streamText.matchAll(/#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+).*BANDWIDTH=(\d+).*\n(.*)/g)]
        .map(([_, resolution, bandwidth, file]) => {
          const [width, height] = resolution.split('x').map(Number);
          return { 
            height, 
            width, 
            file,
            bandwidth: parseInt(bandwidth),
            url: `${url}/manifest/${file}`
          };
        })
        .sort((a, b) => b.height - a.height);

      console.log('Available streams:', streams);

      // Get highest quality stream
      if (streams.length > 0) {
        return {
          url: streams[0].url,
          height: streams[0].height,
          width: streams[0].width,
          bandwidth: streams[0].bandwidth,
          allStreams: streams
        };
      }
      
      // Fallback to default manifest if no streams found
      return {
        url: `${url}/manifest/video.m3u8`,
        height: 720,
        width: 1280,
        bandwidth: 2000000,
        allStreams: []
      };
    } catch (err) {
      console.warn('Error getting highest quality stream:', err);
      return {
        url: `https://videodelivery.net/${id}/manifest/video.m3u8`,
        height: 720,
        width: 1280,
        bandwidth: 2000000,
        allStreams: []
      };
    }
  };

  useEffect(() => {
    let mounted = true;
    let player = null;
    let statsInterval = null;
    let qualityCheckInterval = null; // Declare qualityCheckInterval at this scope level

    const initializePlayer = async () => {
      try {
        // First, dispose of any existing player instances
        if (videoRef.current) {
          const existingPlayers = videojs.getAllPlayers();
          existingPlayers.forEach(p => {
            if (p.el() === videoRef.current || p.tech_.el() === videoRef.current) {
              p.dispose();
            }
          });
        }

        // Clear any existing references
        if (playerRef.current) {
          playerRef.current.dispose();
          unregisterPlayer(clip?.id);
          playerRef.current = null;
        }

        if (!clip?.cloudflare_uid || !videoRef.current || !mounted) return;

        // Get highest quality stream URL first
        const highQualityInfo = await getHighestQualityStream(clip.cloudflare_uid);
        console.log('Highest quality stream:', highQualityInfo);

        // YouTube-like approach: Set initial bandwidth very high to force highest quality
        const options = {
          controls: true,
          fluid: true,
          responsive: true,
          aspectRatio: '16:9',
          playsinline: true,
          preload: 'auto',
          autoplay: false,
          inactivityTimeout: 3000,
          bigPlayButton: true,
          html5: {
            vhs: {
              overrideNative: true,
              fastQualityChange: true,
              useBandwidthFromLocalStorage: false,
              enableLowInitialPlaylist: false,
              limitRenditionByPlayerDimensions: false,
              // Set extremely high bandwidth for all devices - increased to 500 Mbps
              bandwidth: 500000000, // 500 Mbps for all devices
              // Completely disable ABR (Adaptive Bitrate) to force highest quality
              abr: {
                enabled: false, // Disable adaptive bitrate for all devices
                defaultBandwidth: 500000000, // Set default bandwidth extremely high
                bandwidthUpgradeTarget: 1.0, // Immediately upgrade to highest quality
                bandwidthDowngradeTarget: 0.0 // Never downgrade quality
              },
              initialPlaylistSelector: function() {
                // Always select highest quality playlist with no exceptions
                return function(master) {
                  try {
                    // Check if master and playlists are available
                    if (!master || !master.playlists || !master.playlists.length) {
                      console.log('Master or playlists not available in initialPlaylistSelector');
                      return; // Let the player use default selection
                    }
                    
                    // Sort by bandwidth, highest first
                    const sortedPlaylists = master.playlists.slice().sort((a, b) => {
                      return b.attributes.BANDWIDTH - a.attributes.BANDWIDTH;
                    });
                    
                    console.log('initialPlaylistSelector - Forcing highest bandwidth playlist:', 
                      sortedPlaylists[0].attributes.BANDWIDTH / 1000, 'kbps',
                      sortedPlaylists[0].attributes.RESOLUTION ? 
                        `${sortedPlaylists[0].attributes.RESOLUTION.width}x${sortedPlaylists[0].attributes.RESOLUTION.height}` : 
                        'unknown resolution');
                    
                    // Always return the highest bandwidth playlist, no exceptions
                    return sortedPlaylists[0];
                  } catch (err) {
                    console.warn('Error in initialPlaylistSelector:', err);
                    return; // Let the player use default selection
                  }
                };
              }()
            },
            nativeAudioTracks: false,
            nativeVideoTracks: false
          },
          controlBar: {
            playToggle: true
          },
          userActions: {
            click: true,
            hotkeys: true
          }
        };

        // Create new player instance
        player = videojs(videoRef.current, options);
        playerRef.current = player;

        // Add stats button to control bar
        const controlBar = player.getChild('controlBar');
        if (controlBar) {
          // First, remove ALL existing stats buttons and any potential duplicates
          // This is a more aggressive approach to ensure no duplicates remain
          const removeExistingButtons = () => {
            // Remove by class name
            const statsButtons = player.el().querySelectorAll('.vjs-stats-button');
            statsButtons.forEach(button => {
              button.parentNode.removeChild(button);
            });
            
            // Also remove from control bar children
            for (let i = controlBar.children_.length - 1; i >= 0; i--) {
              const child = controlBar.children_[i];
              if (child && 
                  ((child.el_ && child.el_.className && child.el_.className.includes('vjs-stats-button')) ||
                   (child.options_ && child.options_.className && child.options_.className.includes('vjs-stats-button')))) {
                console.log('Removing existing stats button at index:', i);
                controlBar.removeChild(child);
              }
            }
          };
          
          // Remove any existing buttons
          removeExistingButtons();
          
          // Now add the new stats button
          const statsButton = videojs.getComponent('StatsButton');
          const statsButtonInstance = new statsButton(player, {
            onStatsClick: () => {
              console.log('Stats button clicked, current showStats state:', showStats);
              setShowStats(prev => {
                const newState = !prev;
                console.log('Setting showStats to:', newState);
                return newState;
              });
            }
          });
          
          // Add the button before the fullscreen button
          const fullscreenButton = controlBar.getChild('fullscreenToggle');
          const index = fullscreenButton ? controlBar.children_.indexOf(fullscreenButton) : controlBar.children_.length - 1;
          
          // Add the new button
          controlBar.addChild(statsButtonInstance, {}, index);
          console.log('Stats button added to control bar at index:', index);
          
          // Double-check for duplicates after a short delay
          safeSetTimeout(() => {
            const statsButtons = player.el().querySelectorAll('.vjs-stats-button');
            if (statsButtons.length > 1) {
              console.warn('Multiple HD buttons detected after adding, cleaning up...');
              // Keep only the last one (which should be our newly added button)
              for (let i = 0; i < statsButtons.length - 1; i++) {
                if (statsButtons[i].parentNode) {
                  statsButtons[i].parentNode.removeChild(statsButtons[i]);
                }
              }
            }
          }, 100);
        }

        // Add playback monitoring
        const handlePlaybackIssue = () => {
          if (!player) return;
          
          const tech = player.tech({ IWillNotUseThisInPlugins: true });
          if (tech) {
            // Force video element refresh
            const videoEl = tech.el();
            if (videoEl) {
              videoEl.style.display = 'none';
              safeSetTimeout(() => {
                videoEl.style.display = 'block';
              }, 50);
            }
          }
        };

        // Monitor playback issues
        player.on('stalled', handlePlaybackIssue);
        player.on('waiting', () => {
          if (mounted) {
            onLoadingChange?.(true);
            handlePlaybackIssue();
          }
        });
        
        player.on('canplay', () => {
          if (mounted) {
            onLoadingChange?.(false);
          }
        });

        player.on('error', (error) => {
          console.error('Video playback error:', error);
          if (player && player.error) {
            console.error('Player error details:', player.error());
          }
          setError('Failed to load video');
        });

        // Basic audio initialization - simplified approach
        const initAudio = () => {
          try {
            console.log('Initializing audio with simplified approach');
            
            // 1. Unmute at player level first
            player.muted(false);
            player.volume(1.0);
            
            // 2. Get the tech and video element
            const tech = player.tech({ IWillNotUseThisInPlugins: true });
            if (!tech) return;
            
            // 3. Unmute at tech level
            tech.setMuted(false);
            
            // 4. Get the actual HTML video element and unmute directly
            const videoEl = tech.el();
            if (videoEl) {
              // Direct manipulation of HTML5 video element
              videoEl.muted = false;
              videoEl.volume = 1.0;
              
              // Force audio playback
              if (videoEl.audioTracks && videoEl.audioTracks.length > 0) {
                for (let i = 0; i < videoEl.audioTracks.length; i++) {
                  videoEl.audioTracks[i].enabled = true;
                }
              }
              
              // Log audio tracks if available
              if (tech.audioTracks && tech.audioTracks.length > 0) {
                console.log('Available audio tracks:', tech.audioTracks.length);
                for (let i = 0; i < tech.audioTracks.length; i++) {
                  console.log(`Audio track ${i}:`, tech.audioTracks[i].label, 'enabled:', tech.audioTracks[i].enabled);
                  tech.audioTracks[i].enabled = true;
                }
            } else {
                console.log('No audio tracks found in tech');
              }
            }
            
            console.log('Audio initialization complete');
          } catch (err) {
            console.warn('Audio initialization error:', err);
          }
        };

        // Set up audio handling
        player.on('ready', () => {
          console.log('Player ready, initializing audio');
          initAudio();
          
          // Check player size when it's ready
          if (wrapperRef.current) {
            const { width, height } = wrapperRef.current.getBoundingClientRect();
            const isSmall = width < 640 || height < 400;
            setIsSmallPlayer(isSmall);
            console.log(`Player ready size: ${width}x${height}, isSmall: ${isSmall}`);
            
            // Update player UI based on size
            updatePlayerUIForSize(player, isSmall);
          }
        });

        // Ensure audio is enabled at key points
        player.on('loadeddata', () => {
          console.log('Video data loaded, initializing audio');
          initAudio();
        });
        
        player.on('play', () => {
          console.log('Play event, initializing audio');
          initAudio();
          
          // Also try to pause other players
          try {
            pauseOthers(clip.id);
          } catch (err) {
            console.error('Error handling play event:', err);
          }
        });
        
        player.on('playing', () => {
          console.log('Playing event, initializing audio');
          initAudio();
        });
        
        // Add additional audio check after quality changes
        player.on('qualitychange', () => {
          console.log('Quality changed, initializing audio');
          safeSetTimeout(initAudio, 100);
        });

        // Handle volume changes
        player.on('volumechange', () => {
          console.log('Volume changed:', player.volume(), 'muted:', player.muted());
          if (player.muted()) {
            player.muted(false);
          }
        });

        // Set poster
        player.poster(`https://videodelivery.net/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg?time=1s&height=1080&width=1920`);

        // Use the master playlist instead of direct quality URL to ensure audio tracks are included
        player.src({
          src: `https://videodelivery.net/${clip.cloudflare_uid}/manifest/video.m3u8`,
          type: 'application/x-mpegURL'
        });

        // Also check size when video source changes
        player.on('loadedmetadata', () => {
          console.log('Metadata loaded, setting highest quality');
          
          // Check player size again when video metadata is loaded
          if (wrapperRef.current) {
            const { width, height } = wrapperRef.current.getBoundingClientRect();
            const isSmall = width < 640 || height < 400;
            setIsSmallPlayer(isSmall);
            console.log(`Player metadata loaded size: ${width}x${height}, isSmall: ${isSmall}`);
          }
          
          // Function to set highest quality that can be retried
          const setHighestQuality = (retryCount = 0) => {
            try {
              const tech = player.tech({ IWillNotUseThisInPlugins: true });
              if (!tech || !tech.vhs) {
                console.log('VHS tech not available for quality selection');
                if (retryCount < 5) { // Increased retry count from 3 to 5
                  console.log(`Retrying quality selection in 500ms (attempt ${retryCount + 1}/5)`);
                  safeSetTimeout(() => setHighestQuality(retryCount + 1), 500);
                }
                return;
              }
              
              // Set extremely high bandwidth to force high quality - increased to 500 Mbps
              if (tech.vhs.masterPlaylistController_ && 
                  tech.vhs.masterPlaylistController_.mainSegmentLoader_) {
                const bandwidthValue = 500000000; // 500 Mbps for all devices
                tech.vhs.masterPlaylistController_.mainSegmentLoader_.bandwidth = bandwidthValue;
                console.log(`Set extremely high bandwidth in segment loader: ${bandwidthValue/1000000} Mbps`);
                
                // Force immediate playlist update
                if (typeof tech.vhs.masterPlaylistController_.fastQualityChange_ === 'function') {
                  tech.vhs.masterPlaylistController_.fastQualityChange_();
                  console.log('Forced fast quality change');
                }
              } else {
                console.log('VHS controller or segment loader not available');
                if (retryCount < 5) {
                  console.log(`Retrying quality selection in 500ms (attempt ${retryCount + 1}/5)`);
                  safeSetTimeout(() => setHighestQuality(retryCount + 1), 500);
                }
                return;
              }
              
              // Override playlist selection to always choose highest quality
              if (typeof tech.vhs.selectPlaylist === 'function') {
                const originalSelectPlaylist = tech.vhs.selectPlaylist;
                tech.vhs.selectPlaylist = function() {
                  try {
                    // Get all playlists
                    if (!tech.vhs.master || !tech.vhs.master.playlists || !tech.vhs.master.playlists.length) {
                      console.log('No playlists available in master, using original selector');
                      return originalSelectPlaylist.apply(this, arguments);
                    }
                    
                    const playlists = tech.vhs.master.playlists;
                    
                    // Sort by bandwidth, highest first
                    const sortedPlaylists = playlists.slice().sort((a, b) => {
                      return b.attributes.BANDWIDTH - a.attributes.BANDWIDTH;
                    });
                    
                    console.log('Available playlists:');
                    sortedPlaylists.forEach((p, i) => {
                      console.log(`  ${i}: ${p.attributes.BANDWIDTH/1000} kbps, ${p.attributes.RESOLUTION?.width}x${p.attributes.RESOLUTION?.height}`);
                    });
                    
                    console.log('Selected highest bandwidth playlist:', 
                      sortedPlaylists[0].attributes.BANDWIDTH / 1000, 'kbps',
                      sortedPlaylists[0].attributes.RESOLUTION ? 
                        `${sortedPlaylists[0].attributes.RESOLUTION.width}x${sortedPlaylists[0].attributes.RESOLUTION.height}` : 
                        'unknown resolution');
                    
                    // Return the highest bandwidth playlist
                    return sortedPlaylists[0];
                  } catch (err) {
                    console.warn('Error in playlist selection:', err);
                    return originalSelectPlaylist.apply(this, arguments);
                  }
                };
                console.log('Overrode playlist selection to always choose highest quality');
              }
              
              // Only proceed with representations if they exist
              const representations = tech.vhs.representations();
              if (!representations || !representations.length) {
                console.log('No representations available');
                if (retryCount < 5) {
                  console.log(`Retrying quality selection in 500ms (attempt ${retryCount + 1}/5)`);
                  safeSetTimeout(() => setHighestQuality(retryCount + 1), 500);
                }
                return;
              }
              
              console.log('Available representations:');
              representations.forEach((rep, i) => {
                console.log(`  ${i}: ${rep.id}, ${rep.width}x${rep.height}, ${rep.bandwidth/1000} kbps`);
              });
              
              // Find the highest quality representation
              let highestQuality = null;
              let highestHeight = 0;
              
              representations.forEach(rep => {
                try {
                  const height = parseInt(rep.height);
                  if (height > highestHeight) {
                    highestHeight = height;
                    highestQuality = rep;
                  }
                  
                  // Initially disable all qualities
                  if (typeof rep.enabled === 'function') {
                    rep.enabled(false);
                  }
                } catch (err) {
                  console.warn('Error processing representation:', err);
                }
              });
              
              // Enable only the highest quality
              if (highestQuality && typeof highestQuality.enabled === 'function') {
                console.log('Setting highest quality:', highestQuality.height + 'p', 
                  `(${highestQuality.width}x${highestQuality.height}, ${Math.round(highestQuality.bandwidth/1000)} kbps)`);
                highestQuality.enabled(true);

                // Update stats
                setVideoStats({
                  currentQuality: `${highestQuality.height}p`,
                  resolution: `${highestQuality.width}x${highestQuality.height}`,
                  bandwidth: Math.round(highestQuality.bandwidth / 1000) + ' Kbps',
                  availableQualities: representations.map(rep => ({
                    id: rep.id,
                    height: rep.height,
                    width: rep.width,
                    bandwidth: rep.bandwidth
                  }))
                });
                
                // Force immediate quality update
                if (tech.vhs.masterPlaylistController_ && 
                    typeof tech.vhs.masterPlaylistController_.fastQualityChange_ === 'function') {
                  tech.vhs.masterPlaylistController_.fastQualityChange_();
                  console.log('Forced fast quality change after representation selection');
                }
              } else {
                console.log('No highest quality representation found or cannot be enabled');
                if (retryCount < 5) {
                  console.log(`Retrying quality selection in 500ms (attempt ${retryCount + 1}/5)`);
                  safeSetTimeout(() => setHighestQuality(retryCount + 1), 500);
                }
              }
              
              // Ensure audio is initialized after quality selection
              safeSetTimeout(initAudio, 100);
            } catch (err) {
              console.warn('Error setting initial quality:', err);
              // Retry up to 5 times with a delay
              if (retryCount < 5) {
                console.log(`Retrying quality selection in 500ms (attempt ${retryCount + 1}/5)`);
                safeSetTimeout(() => setHighestQuality(retryCount + 1), 500);
              } else {
                // Still try to initialize audio even if quality setting fails
                safeSetTimeout(initAudio, 100);
              }
            }
          };
          
          // Start the quality selection process
          setHighestQuality(0);
        });

        // Modify the play method to ensure high quality on first play
        const originalPlay = player.play;
        player.play = function() {
          // If this is the first play attempt, ensure we're at highest quality
          if (!initialPlayAttemptRef.current) {
            initialPlayAttemptRef.current = true;
            console.log('First play attempt - ensuring highest quality');
            
            try {
              const tech = player.tech({ IWillNotUseThisInPlugins: true });
              if (tech && tech.vhs) {
                // Set extremely high bandwidth
                if (tech.vhs.masterPlaylistController_ && 
                    tech.vhs.masterPlaylistController_.mainSegmentLoader_) {
                  const bandwidthValue = 500000000;
                  tech.vhs.masterPlaylistController_.mainSegmentLoader_.bandwidth = bandwidthValue;
                  console.log(`Set bandwidth for first play: ${bandwidthValue/1000000} Mbps`);
                  
                  // If master playlist is available, log the selected playlist
                  if (tech.vhs.master && tech.vhs.master.playlists && tech.vhs.master.playlists.length) {
                    console.log('Master playlist is available with', tech.vhs.master.playlists.length, 'playlists');
                  } else {
                    console.log('Master playlist not available yet during first play');
                  }
                }
                
                // Force highest quality representation
                const representations = tech.vhs.representations();
                if (representations && representations.length) {
                  // Find highest quality
                  let highestQuality = null;
                  let highestHeight = 0;
                  
                  representations.forEach(rep => {
                    try {
                      const height = parseInt(rep.height);
                      if (height > highestHeight) {
                        highestHeight = height;
                        highestQuality = rep;
                      }
                      
                      // Disable all qualities first
                      if (typeof rep.enabled === 'function') {
                        rep.enabled(false);
                      }
                    } catch (err) {
                      console.warn('Error in first play quality setup:', err);
                    }
                  });
                  
                  // Enable only highest quality
                  if (highestQuality && typeof highestQuality.enabled === 'function') {
                    highestQuality.enabled(true);
                    console.log(`Forced highest quality (${highestHeight}p) for first play`);
                    
                    // Force immediate quality update
                    if (tech.vhs.masterPlaylistController_ && 
                        typeof tech.vhs.masterPlaylistController_.fastQualityChange_ === 'function') {
                      tech.vhs.masterPlaylistController_.fastQualityChange_();
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('Error ensuring high quality on first play:', err);
            }
          }
          
          // Call the original play method
          return originalPlay.apply(this, arguments);
        };

        // YouTube-like approach: Preload video data
        player.one('canplaythrough', () => {
          console.log('Video can play through, preloading more data');
          
          // Preload more video data
          try {
            if (player.tech_ && 
                player.tech_.vhs) {
              
              // Check if masterPlaylistController_ exists
              if (player.tech_.vhs.masterPlaylistController_ && 
                  player.tech_.vhs.masterPlaylistController_.mainSegmentLoader_) {
                // Set to 100 Mbps - extremely high to ensure highest quality
                // Use even higher value for mobile to override mobile optimizations
                const bandwidthValue = 500000000; // 500 Mbps for all devices
                player.tech_.vhs.masterPlaylistController_.mainSegmentLoader_.bandwidth = bandwidthValue;
                console.log(`Successfully set bandwidth for preloading: ${bandwidthValue/1000000} Mbps (Mobile: ${isMobileDevice})`);
                
                // Force immediate quality update
                if (typeof player.tech_.vhs.masterPlaylistController_.fastQualityChange_ === 'function') {
                  player.tech_.vhs.masterPlaylistController_.fastQualityChange_();
                  console.log('Forced fast quality change during preloading');
                }
              } else {
                console.log('VHS masterPlaylistController_ or mainSegmentLoader_ not available for preloading');
              }
              
              // Check current quality and log it
              const representations = player.tech_.vhs.representations();
              if (representations && representations.length > 0) {
                const currentQuality = representations.find(rep => rep.enabled && typeof rep.enabled === 'function' && rep.enabled());
                if (currentQuality) {
                  console.log('Current quality after preloading:', 
                    `${currentQuality.height}p (${currentQuality.width}x${currentQuality.height}, ${Math.round(currentQuality.bandwidth/1000)} kbps)`);
                } else {
                  console.log('No enabled representation found after preloading');
                }
              } else {
                console.log('No representations available for quality check after preloading');
              }
            } else {
              console.log('VHS tech not fully available for preloading');
            }
          } catch (err) {
            console.warn('Error during preloading:', err);
          }
          
          // Initialize audio again
          initAudio();
          
          // Mark as buffered high quality
          setHasBufferedHighQuality(true);
        });

        playerRef.current = player;
        registerPlayer(clip.id, player);

        // Set up playback monitoring with buffering detection
        player.on('playing', () => {
          if (mounted) {
            console.log('Video actually playing');
            setIsActuallyPlaying(true);
            setIsBuffering(false);
            startPlaybackTracking();
          }
        });

        player.on('waiting', () => {
          if (mounted) {
            console.log('Video buffering');
            setIsBuffering(true);
            onLoadingChange?.(true);
          }
        });

        player.on('canplay', () => {
          if (mounted) {
            console.log('Video can play');
            setIsBuffering(false);
            onLoadingChange?.(false);
          }
        });

        player.on('pause', () => {
          if (mounted) {
            console.log('Video paused');
            setIsActuallyPlaying(false);
            stopPlaybackTracking();
          }
        });

        player.on('ended', () => {
          if (mounted) {
            console.log('Video ended');
            setIsActuallyPlaying(false);
            stopPlaybackTracking();
          }
        });

        player.on('timeupdate', () => {
          if (mounted && player && !isBuffering) {
            const currentTime = Math.floor(player.currentTime());
            const isPlaying = !player.paused();
            console.log('Video timeupdate:', { 
              currentTime, 
              isPlaying,
              playbackTime,
              hasTrackedView,
              isBuffering 
            });
          }
        });

        // Update stats periodically
        statsInterval = setInterval(() => {
          if (player && mounted) {
            try {
              // Get current quality
              let currentQuality = videoStats.currentQuality;
              let resolution = videoStats.resolution;
              let bandwidth = videoStats.bandwidth;
              let availableQualities = videoStats.availableQualities;
              
              const tech = player.tech({ IWillNotUseThisInPlugins: true });
              if (tech && tech.vhs) {
                const representations = tech.vhs.representations();
                if (representations && representations.length) {
                  // Find enabled representation
                  const enabledRep = representations.find(rep => rep.enabled && typeof rep.enabled === 'function' && rep.enabled());
                  
                  if (enabledRep) {
                    currentQuality = `${enabledRep.height}p`;
                    resolution = `${enabledRep.width}x${enabledRep.height}`;
                    bandwidth = Math.round(enabledRep.bandwidth / 1000) + ' Kbps';
                    
                    // Check if we're not at the highest quality and force it if needed
                    // This is especially important for mobile devices
                    if (representations.length > 1) {
                      // Find the highest quality representation
                      let highestQuality = null;
                      let highestHeight = 0;
                      
                      representations.forEach(rep => {
                        try {
                          const height = parseInt(rep.height);
                          if (height > highestHeight) {
                            highestHeight = height;
                            highestQuality = rep;
                          }
                        } catch (err) {
                          console.warn('Error processing representation:', err);
                        }
                      });
                      
                      // If we're not at the highest quality, force it
                      if (highestQuality && enabledRep.id !== highestQuality.id) {
                        console.log(`Detected quality drop. Current: ${enabledRep.height}p, Highest: ${highestQuality.height}p. Forcing highest quality.`);
                        
                        // Disable all qualities first
                        representations.forEach(rep => {
                          try {
                            if (typeof rep.enabled === 'function') {
                              rep.enabled(false);
                            }
                          } catch (err) {
                            console.warn('Error disabling representation:', err);
                          }
                        });
                        
                        // Enable only the highest quality
                        if (typeof highestQuality.enabled === 'function') {
                          highestQuality.enabled(true);
                          
                          // Set bandwidth to extremely high value
                          if (tech.vhs.masterPlaylistController_ && 
                              tech.vhs.masterPlaylistController_.mainSegmentLoader_) {
                            tech.vhs.masterPlaylistController_.mainSegmentLoader_.bandwidth = 500000000; // 500 Mbps
                            console.log('Reset bandwidth to 500 Mbps to maintain highest quality');
                            
                            // Force immediate quality update
                            if (typeof tech.vhs.masterPlaylistController_.fastQualityChange_ === 'function') {
                              tech.vhs.masterPlaylistController_.fastQualityChange_();
                            }
                          } else {
                            console.log('VHS masterPlaylistController_ or mainSegmentLoader_ not available for bandwidth adjustment');
                          }
                        }
                      }
                    }
                  } else {
                    console.log('No enabled representation found during stats update');
                  }
                  
                  // Update available qualities
                  availableQualities = representations.map(rep => ({
                    id: rep.id,
                    height: rep.height,
                    width: rep.width,
                    bandwidth: rep.bandwidth
                  }));
                } else {
                  console.log('No representations available during stats update');
                }
              }
              
              // Get playback stats
              const currentTime = player.currentTime();
              const duration = player.duration();
              
              // Get buffer info
              let buffered = 0;
              if (player.buffered() && player.buffered().length > 0) {
                buffered = player.buffered().end(player.buffered().length - 1);
              }
              
              // Get player state
              let playerState = 'Unknown';
              if (player.paused()) {
                playerState = 'Paused';
              } else if (player.ended()) {
                playerState = 'Ended';
              } else if (player.seeking()) {
                playerState = 'Seeking';
              } else if (isBuffering) {
                playerState = 'Buffering';
              } else if (typeof player.readyState === 'function' && player.readyState() >= 3) {
                playerState = 'Playing';
              } else {
                playerState = 'Loading';
              }
              
              // Update stats
              setVideoStats({
                currentQuality,
                resolution,
                bandwidth,
                availableQualities,
                currentTime,
                duration,
                buffered,
                playerState
              });
            } catch (err) {
              console.warn('Error updating stats:', err);
            }
          }
        }, 1000);

        // Add a periodic quality check to force highest quality if it ever drops
        qualityCheckInterval = setInterval(() => {
          try {
            // Comprehensive check to ensure player is fully initialized
            if (!player || 
                player.disposed || 
                !player.tech_ || 
                !player.tech_.el_ || 
                typeof player.paused !== 'function' || 
                typeof player.readyState !== 'function' ||
                typeof player.tech !== 'function') {
              console.log('Player not fully initialized for quality check, skipping');
              return;
            }
            
            // Safely check if player is paused - with additional tech checks
            let isPaused = true;
            try {
              // Make sure the tech object and its methods are available
              if (player.tech_ && player.tech_.el_ && typeof player.paused === 'function') {
                isPaused = player.paused();
              } else {
                console.log('Player tech not fully initialized, skipping quality check');
                return;
              }
            } catch (err) {
              console.warn('Error checking paused state:', err);
              return; // Exit early if we can't determine pause state
            }
            
            // Only proceed if player is playing and ready
            if (!isPaused && typeof player.readyState === 'function' && player.readyState() >= 3) {
              // Safely access tech
              if (typeof player.tech !== 'function') {
                console.log('Player tech method not available, skipping quality check');
                return;
              }
              
              const tech = player.tech({ IWillNotUseThisInPlugins: true });
              if (!tech || !tech.vhs) return;
              
              // Set extremely high bandwidth again
              if (tech.vhs.masterPlaylistController_ && 
                  tech.vhs.masterPlaylistController_.mainSegmentLoader_) {
                tech.vhs.masterPlaylistController_.mainSegmentLoader_.bandwidth = 500000000; // 500 Mbps
              }
              
              // Check if we're at highest quality
              const representations = tech.vhs.representations();
              if (!representations || !representations.length) return;
              
              // Find highest quality representation
              let highestQuality = null;
              let highestHeight = 0;
              let currentQuality = null;
              
              representations.forEach(rep => {
                try {
                  const height = parseInt(rep.height);
                  if (height > highestHeight) {
                    highestHeight = height;
                    highestQuality = rep;
                  }
                  
                  // Check if this representation is enabled
                  if (rep.enabled && typeof rep.enabled === 'function' && rep.enabled()) {
                    currentQuality = rep;
                  }
                } catch (err) {
                  console.warn('Error in quality check:', err);
                }
              });
              
              // If we're not at highest quality, force it
              if (highestQuality && currentQuality && highestQuality.id !== currentQuality.id) {
                console.log(`Quality check: Currently at ${currentQuality.height}p but highest is ${highestQuality.height}p. Forcing highest quality.`);
                
                // Disable all qualities
                representations.forEach(rep => {
                  if (typeof rep.enabled === 'function') {
                    rep.enabled(false);
                  }
                });
                
                // Enable only highest quality
                if (typeof highestQuality.enabled === 'function') {
                  highestQuality.enabled(true);
                  
                  // Force immediate quality update
                  if (tech.vhs.masterPlaylistController_ && 
                      typeof tech.vhs.masterPlaylistController_.fastQualityChange_ === 'function') {
                    tech.vhs.masterPlaylistController_.fastQualityChange_();
                  }
                  
                  // Update stats
                  setVideoStats(prev => ({
                    ...prev,
                    currentQuality: `${highestQuality.height}p`,
                    resolution: `${highestQuality.width}x${highestQuality.height}`,
                    bandwidth: Math.round(highestQuality.bandwidth / 1000) + ' Kbps'
                  }));
                }
              }
            }
          } catch (err) {
            console.warn('Error in periodic quality check:', err);
          }
        }, 2000);

      } catch (err) {
        console.error('Error initializing player:', err);
        if (mounted) {
        setError('Failed to initialize video player');
        }
      }
    };

    initializePlayer();

    // Cleanup function
    return () => {
      mounted = false;
      stopPlaybackTracking();
      
      // Clear stats interval
      if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
      }
      
      // Clear quality check interval
      if (qualityCheckInterval) {
        clearInterval(qualityCheckInterval);
        qualityCheckInterval = null;
      }
      
      // Clear all pending timeouts
      timeoutIdsRef.current.forEach(id => {
        clearTimeout(id);
      });
      timeoutIdsRef.current = [];
      
      // Clean up any HD buttons that might be in the DOM
      try {
        // Query for all HD buttons in the document
        const statsButtons = document.querySelectorAll('.vjs-stats-button');
        statsButtons.forEach(button => {
          if (button.parentNode) {
            button.parentNode.removeChild(button);
          }
        });
      } catch (err) {
        console.warn('Error cleaning up HD buttons:', err);
      }
      
      // Dispose of player and unregister it
      if (player) {
        try {
          // Remove all event listeners explicitly
          const events = [
            'stalled', 'waiting', 'canplay', 'error', 'ready', 
            'loadeddata', 'play', 'playing', 'qualitychange', 
            'volumechange', 'loadedmetadata', 'canplaythrough',
            'pause', 'ended', 'timeupdate'
          ];
          
          events.forEach(event => {
            try {
              player.off(event);
            } catch (e) {
              console.warn(`Error removing ${event} listener:`, e);
            }
          });
          
          // Dispose the player
          player.dispose();
          
          // Unregister from context
          try {
            unregisterPlayer(clip?.id);
          } catch (err) {
            console.warn('Error unregistering player:', err);
          }
        } catch (err) {
          console.warn('Error during player cleanup:', err);
        }
      }
      
      // Clear player reference
      playerRef.current = null;
    };
  }, [clip?.cloudflare_uid]);

  return (
    <div 
      className={`${styles.videoWrapper} ${isSmallPlayer ? styles['small-player'] : ''}`}
      ref={wrapperRef}
    >
      <div data-vjs-player>
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-default-skin"
          playsInline
        >
          <p className="vjs-no-js">
            To view this video please enable JavaScript, and consider upgrading to a
            web browser that supports HTML5 video
          </p>
        </video>
        {/* Mobile touch overlay */}
        <div 
          className={styles.mobileOverlay}
          onClick={(e) => {
            if (!playerRef.current) return;
            
            // Don't handle if clicking controls
            if (
              e.target.closest('.vjs-control-bar') || 
              e.target.closest('.vjs-menu') || 
              e.target.closest('.vjs-volume-panel') ||
              e.target.closest('.vjs-progress-control')
            ) {
              return;
            }

            // Handle big play button separately
            if (e.target.closest('.vjs-big-play-button')) {
              playerRef.current.play().catch(console.warn);
              return;
            }

            if (playerRef.current.paused()) {
              playerRef.current.play().catch(console.warn);
            } else {
              playerRef.current.pause();
            }
          }}
        />
      </div>
      
      {/* Stats overlay */}
      {showStats && (
        <div className={`${styles.statsOverlay} ${isSmallPlayer ? styles.smallStatsOverlay : ''}`}>
          <div className={styles.statsHeader}>
            <h3>Video Stats</h3>
          <button 
              className={styles.closeButton}
              onClick={() => {
                console.log('Close button clicked, setting showStats to false');
                setShowStats(false);
              }}
            >
              <MdClose />
          </button>
            </div>
          <div className={styles.statsContent}>
            <p><strong>Quality:</strong> {videoStats.currentQuality}</p>
            <p><strong>Resolution:</strong> {videoStats.resolution}</p>
            <p><strong>Bandwidth:</strong> {videoStats.bandwidth}</p>
            <p><strong>State:</strong> {videoStats.playerState}</p>
            <p><strong>Time:</strong> {Math.floor(videoStats.currentTime / 60)}:{Math.floor(videoStats.currentTime % 60).toString().padStart(2, '0')} / {Math.floor(videoStats.duration / 60)}:{Math.floor(videoStats.duration % 60).toString().padStart(2, '0')}</p>
            <p><strong>Buffered:</strong> {Math.round((videoStats.buffered / videoStats.duration) * 100)}%</p>
            
            {videoStats.availableQualities.length > 0 && (
              <>
                <p><strong>Available Qualities:</strong></p>
                <div className={styles.qualityButtons}>
                  {videoStats.availableQualities
                    .sort((a, b) => b.height - a.height)
                    .map(quality => (
                      <button
                        key={quality.id}
                        className={`${styles.qualityButton} ${videoStats.currentQuality === `${quality.height}p` ? styles.active : ''}`}
                        onClick={() => handleQualityChange(quality)}
                      >
                        {quality.height}p
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className={styles.errorOverlay}>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;