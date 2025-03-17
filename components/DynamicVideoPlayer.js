import React, { useState } from 'react';
import styles from '../styles/VideoPlayer.module.css';

const DynamicVideoPlayer = ({ clip, onPlayerEvent, isInClipCard }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reloadKey, setReloadKey] = useState(Date.now());

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    // Force iframe reload by updating a key
    setReloadKey(Date.now());
  };

  if (!clip?.cloudflare_uid) {
    return (
      <div className={styles.emptyPlayer}>
        No video available
      </div>
    );
  }

  return (
    <div 
      className={`${styles.videoWrapper} ${isInClipCard ? styles.inClipCard : ''}`}
    >
      {isLoading && !error && (
        <div className={styles.loadingPlayer}>
          <div className={styles.loadingSpinner}></div>
        </div>
      )}
      
      {error && (
        <div className={styles.errorOverlay}>
          <p>{error}</p>
          <button className={styles.retryButton} onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}
      
      <div className={styles.iframeContainer}>
        <iframe
          key={reloadKey}
          src={`https://iframe.videodelivery.net/${clip.cloudflare_uid}`}
          style={{
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%'
          }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen={true}
          onLoad={() => {
            setIsLoading(false);
            onPlayerEvent('playing');
            setIsPlaying(true);
            onPlayerEvent('playerReady', null);
          }}
          onError={() => {
            setError('Video playback error');
            onPlayerEvent('error', 'Video playback error');
          }}
        ></iframe>
      </div>
    </div>
  );
};

export default DynamicVideoPlayer;