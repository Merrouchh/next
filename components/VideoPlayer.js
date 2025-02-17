import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles/VideoPlayer.module.css';
import { trackView } from '../utils/viewTracking';
import { useVideo } from '../contexts/VideoContext';

const VideoPlayer = ({ clip, user, onLoadingChange }) => {
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const { registerPlayer, unregisterPlayer, pauseOthers } = useVideo();
  const [error, setError] = useState(null);

  const getPlayerUrl = (videoId) => {
    if (!videoId) return '';
    
    const thumbnailUrl = `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`;

    const params = new URLSearchParams({
      preload: 'auto',
      primaryColor: 'rgb(255, 208, 0)',
      poster: thumbnailUrl,
      controls: 'true',
      aspectratio: '16:9'  // Force 16:9 aspect ratio
    });

    return `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${videoId}/iframe?${params.toString()}`;
  };

  useEffect(() => {
    let mounted = true;

    const initializePlayer = async () => {
      if (!mounted || !iframeRef.current || !clip?.cloudflare_uid || !window.Stream) return;

      const player = window.Stream(iframeRef.current);
      playerRef.current = player;
      registerPlayer(clip.id, player);

      const handlers = {
        play: async () => {
          await pauseOthers(clip.id);
          if (!hasTrackedView && mounted) {
            await trackView(clip.id, user?.id);
            setHasTrackedView(true);
          }
        },
        waiting: () => mounted && onLoadingChange?.(true),
        canplay: () => mounted && onLoadingChange?.(false)
      };

      // Add event listeners
      Object.entries(handlers).forEach(([event, handler]) => {
        player.addEventListener(event, handler);
      });

      // Store for cleanup
      playerRef.current.handlers = handlers;
    };

    // Load SDK if needed
    if (!window.Stream) {
      const script = document.createElement('script');
      script.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
      script.async = true;
      script.onload = initializePlayer;
      document.body.appendChild(script);
    } else {
      initializePlayer();
    }

    return () => {
      mounted = false;
      if (playerRef.current) {
        Object.entries(playerRef.current.handlers || {}).forEach(([event, handler]) =>
          playerRef.current.removeEventListener(event, handler)
        );
        unregisterPlayer(clip.id);
        playerRef.current = null;
      }
    };
  }, [clip?.cloudflare_uid]);

  return (
    <div className={styles.videoWrapper}>
      <iframe
        ref={iframeRef}
        src={getPlayerUrl(clip?.cloudflare_uid)}
        className={styles.video}
        allow="accelerometer; gyroscope; picture-in-picture;"
        allowFullScreen
        loading="lazy"
        title={`Video ${clip.id}`}
      />
      {error && (
        <div className={styles.errorOverlay}>
          <button onClick={() => {
            setError(null);
            if (playerRef.current) {
              playerRef.current.load();
            }
          }}>Try Again</button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;