import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/http-streaming';
import styles from '../styles/VideoPlayer.module.css';
import { trackView } from '../utils/viewTracking';
import { useVideo } from '../contexts/VideoContext';
import { MdClose } from 'react-icons/md';

// Custom HD/Stats Button Component
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
      return super.createEl('button', {
        innerHTML: '<span class="vjs-icon-placeholder">HD</span>',
        className: 'vjs-stats-button vjs-control vjs-button'
      });
    }
  }
  videojs.registerComponent('StatsButton', StatsButton);
}

const VideoPlayer = ({ clip, user, onLoadingChange }) => {
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const playbackTimerRef = useRef(null);
  const anonymousIdRef = useRef(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const trackingAttemptedRef = useRef(false);
  const { registerPlayer, unregisterPlayer, pauseOthers } = useVideo();
  const [error, setError] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [videoStats, setVideoStats] = useState({
    currentQuality: 'Loading...',
    resolution: '',
    bandwidth: 0,
    availableQualities: []
  });

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
    
    const tech = playerRef.current.tech({ IWillNotUseThisInPlugins: true });
    if (tech && tech.vhs) {
      // Disable user interaction during quality change
      playerRef.current.controls(false);
      
      const representations = tech.vhs.representations();
      
      try {
        // Force disable all qualities first
        representations.forEach(rep => {
          rep.enabled(false);
        });

        // Then enable only the selected quality by ID
        const selectedRep = representations.find(rep => rep.id === selectedQuality.id);
        if (selectedRep) {
          selectedRep.enabled(true);
          
          // Store current time and playing state
          const currentTime = playerRef.current.currentTime();
          const wasPlaying = !playerRef.current.paused();
          
          // Force reload with original HLS URL
          playerRef.current.src({
            src: `https://videodelivery.net/${clip.cloudflare_uid}/manifest/video.m3u8`,
            type: 'application/x-mpegURL',
            withCredentials: false
          });

          // After reload, set quality and restore position
          playerRef.current.one('loadedmetadata', () => {
            try {
              // Re-enable selected quality
              const newTech = playerRef.current.tech({ IWillNotUseThisInPlugins: true });
              if (newTech && newTech.vhs) {
                const newRepresentations = newTech.vhs.representations();
                newRepresentations.forEach(rep => {
                  rep.enabled(rep.id === selectedQuality.id);
                });

                // Monitor quality changes to ensure it sticks
                const handleMediaChange = () => {
                  try {
                    newRepresentations.forEach(rep => {
                      rep.enabled(rep.id === selectedQuality.id);
                    });
                  } catch (err) {
                    console.warn('Quality change monitoring error:', err);
                  }
                };

                newTech.vhs.on('mediachange', handleMediaChange);
                
                // Clean up listener when quality changes again
                playerRef.current.one('qualitychange', () => {
                  newTech.vhs.off('mediachange', handleMediaChange);
                });
              }

              // Restore position and play state
              playerRef.current.currentTime(currentTime);
              if (wasPlaying) {
                playerRef.current.play().catch(console.warn);
              }

              // Update stats with selected quality
              setVideoStats(prev => ({
                ...prev,
                currentQuality: `${selectedQuality.height}p`,
                resolution: `${selectedQuality.width}x${selectedQuality.height}`,
                bandwidth: Math.round(selectedQuality.bandwidth / 1000) + ' Kbps',
                availableQualities: prev.availableQualities
              }));
            } catch (err) {
              console.warn('Quality change error:', err);
            } finally {
              // Re-enable controls
              if (playerRef.current) {
                playerRef.current.controls(true);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Quality change error:', err);
        // Re-enable controls on error
        if (playerRef.current) {
          playerRef.current.controls(true);
        }
      }
    }
  };

  const getHighestQualityStream = async (id) => {
    try {
      const url = `https://videodelivery.net/${id}`;
      const res = await fetch(`${url}/manifest/video.m3u8`);
      const streamText = await res.text();
      
      // Find all quality streams
      const streams = [...streamText.matchAll(/#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+).*\n(.*)/g)]
        .map(([_, resolution, file]) => {
          const [width, height] = resolution.split('x').map(Number);
          return { height, file };
        })
        .sort((a, b) => b.height - a.height);

      // Get highest quality stream
      if (streams.length > 0) {
        return `${url}/manifest/${streams[0].file}`;
      }
      
      // Fallback to default manifest if no streams found
      return `${url}/manifest/video.m3u8`;
    } catch (err) {
      console.warn('Error getting highest quality stream:', err);
      return `https://videodelivery.net/${id}/manifest/video.m3u8`;
    }
  };

  useEffect(() => {
    let mounted = true;
    let player = null;

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
        const highQualityUrl = await getHighestQualityStream(clip.cloudflare_uid);

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
              useBandwidthFromLocalStorage: true,
              enableLowInitialPlaylist: false,
              limitRenditionByPlayerDimensions: false
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

        // Add playback monitoring
        const handlePlaybackIssue = () => {
          if (!player) return;
          
          const tech = player.tech({ IWillNotUseThisInPlugins: true });
          if (tech) {
            // Force video element refresh
            const videoEl = tech.el();
            if (videoEl) {
              videoEl.style.display = 'none';
              setTimeout(() => {
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

        // Set source using regular manifest URL to ensure audio tracks are included
        player.src({
          src: `https://videodelivery.net/${clip.cloudflare_uid}/manifest/video.m3u8`,
          type: 'application/x-mpegURL'
        });

        // Basic audio initialization
        const initAudio = () => {
          const tech = player.tech({ IWillNotUseThisInPlugins: true });
          
          // Unmute at both player and tech level
          if (tech) {
            tech.setMuted(false);
          }
          player.muted(false);
          player.volume(1.0);
        };

        // Set up audio handling
        player.on('ready', () => {
          // Initial audio setup
          initAudio();
          
          // Handle tech-specific setup
          const tech = player.tech({ IWillNotUseThisInPlugins: true });
          if (tech) {
            // Add playing event listener
            tech.el().addEventListener('playing', () => {
              initAudio();
            });
          }
        });

        // Ensure audio is enabled at key points
        player.on('loadeddata', initAudio);
        player.on('play', initAudio);

        // Handle volume changes
        player.on('volumechange', () => {
          if (player.muted()) {
            player.muted(false);
          }
        });

        // Set poster
        player.poster(`https://videodelivery.net/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg?time=1s&height=1080&width=1920`);

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

        // Remove the old play event handler that tracked views immediately
        player.on('play', async () => {
          try {
            await pauseOthers(clip.id);
          } catch (err) {
            console.error('Error handling play event:', err);
          }
        });

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
      if (player) {
        try {
          player.dispose();
          unregisterPlayer(clip?.id);
        } catch (err) {
          console.warn('Error during cleanup:', err);
        }
      }
      playerRef.current = null;
    };
  }, [clip?.cloudflare_uid]);

  return (
    <div className={styles.videoWrapper}>
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

      {/* Error overlay */}
      {error && (
        <div className={styles.errorOverlay}>
          <p>{error}</p>
          <button 
            onClick={() => {
              setError(null);
              if (playerRef.current) {
                playerRef.current.load();
              }
            }}
            className={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;