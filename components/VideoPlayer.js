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
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const { registerPlayer, unregisterPlayer, pauseOthers } = useVideo();
  const [error, setError] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [videoStats, setVideoStats] = useState({
    currentQuality: 'Loading...',
    resolution: '',
    bandwidth: 0,
    availableQualities: []
  });

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
    if (playerRef.current) {
      playerRef.current.dispose();
      unregisterPlayer(clip?.id);
      playerRef.current = null;
    }

    if (!clip?.cloudflare_uid) return;

    let mounted = true;

    const initializePlayer = async () => {
      try {
        // Get highest quality stream URL first
        const highQualityUrl = await getHighestQualityStream(clip.cloudflare_uid);

        const options = {
          controls: true,
          fluid: true,
          responsive: true,
          aspectRatio: '16:9',
          playsinline: true,
          preload: 'auto',
          html5: {
            vhs: {
              overrideNative: true,
              fastQualityChange: true,
              enableLowInitialPlaylist: false
            }
          }
        };

        const player = videojs(videoRef.current, options);

        // Set source to highest quality stream directly
        player.src({
          src: highQualityUrl,
          type: 'application/x-mpegURL'
        });

        // Remove any existing stats buttons from the control bar
        const controlBar = player.getChild('ControlBar');
        if (controlBar) {
          // Find and remove any existing stats buttons
          const existingStatsButton = controlBar.getChild('StatsButton');
          if (existingStatsButton) {
            controlBar.removeChild(existingStatsButton);
          }

          // Add our single stats button
          const fullscreenToggle = controlBar.getChild('FullscreenToggle');
          const statsButton = controlBar.addChild('StatsButton', {
            onStatsClick: () => setShowStats(prev => !prev)
          });

          // Move it before the fullscreen button
          if (fullscreenToggle && statsButton) {
            controlBar.el().insertBefore(
              statsButton.el(),
              fullscreenToggle.el()
            );
          }
        }

        // Set poster
        player.poster(`https://videodelivery.net/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg?time=1s&height=1080&width=1920`);

        // Add a loading state until we get the highest quality
        player.ready(() => {
          player.one('loadedmetadata', () => {
            const tech = player.tech({ IWillNotUseThisInPlugins: true });
            if (tech && tech.vhs) {
              // Wait for highest quality to be loaded before playing
              tech.vhs.representations().sort((a, b) => b.bandwidth - a.bandwidth);
              const highestQuality = tech.vhs.representations()[0];
              
              if (highestQuality) {
                // Enable only highest quality
                tech.vhs.representations().forEach(rep => {
                  rep.enabled(rep.id === highestQuality.id);
                });

                // Disable auto quality switching
                tech.vhs.autoLevelCapping = -1;

                // Wait for buffer to fill with highest quality
                const waitForBuffer = () => {
                  if (player.buffered().length) {
                    const bufferedEnd = player.buffered().end(0);
                    if (bufferedEnd >= 1) { // Wait for at least 1 second of buffer
                      onLoadingChange?.(false);
                      return;
                    }
                  }
                  setTimeout(waitForBuffer, 50);
                };
                waitForBuffer();
              }
            }
          });
        });

        playerRef.current = player;
        registerPlayer(clip.id, player);

        // Event handlers
        player.on('play', async () => {
            try {
              await pauseOthers(clip.id);
              if (!hasTrackedView && mounted) {
                await trackView(clip.id, user?.id);
                setHasTrackedView(true);
              }
            } catch (err) {
              console.error('Error handling play event:', err);
            }
        });

        player.on('waiting', () => mounted && onLoadingChange?.(true));
        player.on('canplay', () => mounted && onLoadingChange?.(false));
        player.on('error', () => {
          console.error('Video playback error:', player.error());
            setError('Failed to load video');
        });

      } catch (err) {
        console.error('Error initializing player:', err);
        setError('Failed to initialize video player');
      }
    };

    initializePlayer();

    return () => {
      mounted = false;
      if (playerRef.current) {
        playerRef.current.dispose();
        unregisterPlayer(clip?.id);
        playerRef.current = null;
      }
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
      </div>
      
      {/* Stats Overlay */}
      {showStats && (
        <div className={`${styles.statsOverlay} ${showStats ? styles.active : ''}`}>
          <button 
            className={styles.closeStats}
            onClick={() => setShowStats(false)}
            aria-label="Close stats"
          >
            <MdClose size={20} />
          </button>
          <div className={styles.statsContent}>
            <h3>Video Stats</h3>
            <div className={styles.statsInfo}>
              <p>Current Quality: {videoStats.currentQuality}</p>
              <p>Resolution: {videoStats.resolution}</p>
              <p>Bandwidth: {videoStats.bandwidth}</p>
            </div>
            <ul>
              {videoStats.availableQualities.map(quality => (
                <li 
                  key={quality.id}
                  className={quality.height + 'p' === videoStats.currentQuality ? styles.active : ''}
                  onClick={() => handleQualityChange(quality)}
                  style={{ cursor: 'pointer' }}
                >
                  {quality.height}p
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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