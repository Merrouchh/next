import React, { useRef, useState, useEffect } from 'react';
import styles from '../styles/VideoPlayer.module.css';
import { trackView } from '../utils/viewTracking';

const VideoPlayer = ({ clip, user, onPlayingChange, onLoadingChange }) => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const isMP4 = clip?.file_path?.toLowerCase().endsWith('.mp4');

  const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip?.file_path || ''}`;
  const thumbnailUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip?.thumbnail_path || ''}`;
  
  const mediaControllerStyle = {
    '--media-primary-color': 'var(--accent-primary)',
    '--media-secondary-color': 'var(--background-secondary)',
    '--media-background': 'var(--background-primary)',
    '--media-control-background': 'var(--background-tertiary)',
    '--media-control-hover': 'var(--accent-glow)',
    '--media-time-color': 'var(--text-secondary)',
    '--media-range-track-color': 'var(--border-primary)',
    '--media-range-track-height': '4px',
    '--media-range-thumb-color': 'var(--accent-primary)',
    '--media-range-thumb-size': '12px',
    '--media-loading-icon-color': 'var(--accent-primary)'
  };

  // Track view when video starts playing
  const handlePlaying = () => {
    if (!hasTrackedView) {
      trackView(clip.id, user?.id).then(() => {
        setHasTrackedView(true);
      });
    }
    onPlayingChange?.(true);
    onLoadingChange?.(false);
  };

  return (
    <>
      <style jsx global>{`
        hls-video, video {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
        }
        
        media-controller {
          aspect-ratio: 16/9 !important;
          width: 100% !important;
          height: auto !important;
          background: var(--background-primary);
          position: relative;
        }

        media-poster-image {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          background: var(--background-primary);
        }

        /* Add black bars for different aspect ratios */
        media-controller::before {
          content: '';
          display: block;
          width: 100%;
          padding-top: 56.25%; /* 16:9 */
        }
      `}</style>
      
      <div className={styles.videoWrapper}>
        <media-controller 
          className={styles.mediaController}
          style={mediaControllerStyle}
        >
          <media-poster-image
            slot="poster"
            src={thumbnailUrl}
            className={styles.poster}
          ></media-poster-image>

          {isMP4 ? (
            <video
              ref={videoRef}
              src={videoUrl}
              slot="media"
              crossOrigin="anonymous"
              playsInline
              className={styles.video}
              onPlaying={handlePlaying}
              onPause={() => onPlayingChange?.(false)}
              onError={() => setError('Failed to load video')}
            />
          ) : (
            <hls-video
              ref={videoRef}
              src={videoUrl}
              slot="media"
              crossorigin
              playsinline
              class={styles.video}
              onLoadStart={() => onLoadingChange?.(true)}
              onCanPlay={() => onLoadingChange?.(false)}
              onWaiting={() => onLoadingChange?.(true)}
              onPlaying={handlePlaying}
              onPause={() => onPlayingChange?.(false)}
              onError={() => {
                setError('Failed to load video');
                onLoadingChange?.(false);
              }}
            ></hls-video>
          )}

          {/* Always show the loading indicator, media-chrome will handle visibility */}
          <media-loading-indicator slot="centered-chrome" noautohide></media-loading-indicator>

          <media-control-bar>
            <media-play-button></media-play-button>
            <media-mute-button></media-mute-button>
            <media-volume-range></media-volume-range>
            <media-time-range></media-time-range>
            <media-time-display showduration remaining></media-time-display>
            <media-playback-rate-button></media-playback-rate-button>
            <media-fullscreen-button></media-fullscreen-button>
          </media-control-bar>

          {error && (
            <div className={styles.errorOverlay}>
              <button onClick={() => {
                setError(null);
                videoRef.current?.load();
              }}>Try Again</button>
            </div>
          )}
        </media-controller>
      </div>
    </>
  );
};

export default VideoPlayer; 