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
      const representations = tech.vhs.representations();
      
      // Force disable all qualities first
      representations.forEach(rep => {
        rep.enabled(false);
      });

      // Then enable only the selected quality by ID
      const selectedRep = representations.find(rep => rep.id === selectedQuality.id);
      if (selectedRep) {
        selectedRep.enabled(true);
        
        // Update stats
        setVideoStats(prev => ({
          ...prev,
          currentQuality: `${selectedQuality.height}p`,
          resolution: `${selectedQuality.width}x${selectedQuality.height}`,
          bandwidth: Math.round(selectedQuality.bandwidth / 1000) + ' Kbps'
        }));

        // Force the player to switch to the new quality
        tech.vhs.representations().forEach(rep => {
          if (rep.id === selectedQuality.id) {
            tech.vhs.playlists.media(rep.playlist);
          }
        });
      }
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
        // VideoJS configuration
        const options = {
          controls: true,
          fluid: true,
          responsive: true,
          aspectRatio: '16:9',
          playsinline: true,
          preload: 'auto',
          controlBar: {
            children: [
              'playToggle',
              'volumePanel',
              'currentTimeDisplay',
              'timeDivider',
              'durationDisplay',
              'progressControl',
              'fullscreenToggle'
            ]
          },
          html5: {
            vhs: {
              overrideNative: true,
              fastQualityChange: true,
              enableLowInitialPlaylist: false,
              limitRenditionByPlayerDimensions: false,
              bandwidth: 20000000,
            }
          }
        };

        // Initialize video.js player
        const player = videojs(videoRef.current, options);

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

        // Set sources after player initialization
        player.src({
          src: `https://videodelivery.net/${clip.cloudflare_uid}/manifest/video.m3u8`,
          type: 'application/x-mpegURL',
          withCredentials: false
        });

        // Set poster
        player.poster(`https://videodelivery.net/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg?time=1s&height=1080&width=1920`);

        // Keep the quality monitoring and stats display
        player.on('loadedmetadata', () => {
          const tech = player.tech({ IWillNotUseThisInPlugins: true });
          if (tech && tech.vhs) {
            const representations = tech.vhs.representations();
            if (representations.length > 0) {
              const qualities = representations.map(rep => ({
                id: rep.id,
                width: rep.width,
                height: rep.height,
                bandwidth: rep.bandwidth
              }));

              // Sort by bandwidth (highest first)
              qualities.sort((a, b) => b.bandwidth - a.bandwidth);
              
              // Set initial highest quality
              representations.forEach(rep => {
                rep.enabled(rep.id === qualities[0].id);
              });
              
              // Update stats
              setVideoStats(prev => ({
                ...prev,
                availableQualities: qualities,
                currentQuality: `${qualities[0].height}p`,
                resolution: `${qualities[0].width}x${qualities[0].height}`,
                bandwidth: Math.round(qualities[0].bandwidth / 1000) + ' Kbps'
              }));

              // Remove automatic quality changes
              tech.vhs.autoLevelCapping = -1;
            }
          }
          onLoadingChange?.(false);
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

    setTimeout(initializePlayer, 0);

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