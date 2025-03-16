import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles/VideoPlayer.module.css';

const DynamicVideoPlayer = ({ clip, onPlayerEvent, isInClipCard }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    if (!clip?.cloudflare_uid) return;
    
    let mounted = true;
    
    const initializePlayer = () => {
      if (!videoRef.current || !containerRef.current) return;
      
      try {
        // Set poster image
        videoRef.current.poster = `https://videodelivery.net/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg?time=1s&height=1080&width=1920`;
        
        // Try different URL formats
        const directUrl = `https://videodelivery.net/${clip.cloudflare_uid}/downloads/default.mp4`;
        const streamUrl = `https://watch.videodelivery.net/${clip.cloudflare_uid}`;
        
        // Set the video URL
        setVideoUrl(directUrl);
        videoRef.current.src = directUrl;
        
        // Event listeners
        const handleCanPlay = () => {
          if (mounted) {
            console.log('Video can play');
            onPlayerEvent('canplay');
            setIsLoading(false);
          }
        };
        
        const handlePlaying = () => {
          if (mounted) {
            console.log('Video playing');
            onPlayerEvent('playing');
            setIsPlaying(true);
            setIsLoading(false);
          }
        };
        
        const handlePause = () => {
          if (mounted) {
            console.log('Video paused');
            onPlayerEvent('pause');
            setIsPlaying(false);
          }
        };
        
        const handleEnded = () => {
          if (mounted) {
            console.log('Video ended');
            onPlayerEvent('ended');
            setIsPlaying(false);
          }
        };
        
        const handleError = (e) => {
          console.error('Video error with direct URL:', e);
          
          // Try the stream URL as fallback
          if (videoRef.current.src !== streamUrl) {
            console.log('Trying stream URL as fallback');
            videoRef.current.src = streamUrl;
            setVideoUrl(streamUrl);
            videoRef.current.load();
            return;
          }
          
          onPlayerEvent('error', 'Video playback error');
          setError('Failed to load video. Please try downloading instead.');
        };
        
        const handleWaiting = () => {
          if (mounted) {
            console.log('Video buffering');
            onPlayerEvent('waiting');
          }
        };
        
        // Add event listeners
        videoRef.current.addEventListener('canplay', handleCanPlay);
        videoRef.current.addEventListener('playing', handlePlaying);
        videoRef.current.addEventListener('pause', handlePause);
        videoRef.current.addEventListener('ended', handleEnded);
        videoRef.current.addEventListener('error', handleError);
        videoRef.current.addEventListener('waiting', handleWaiting);
        
        // Load the video
        videoRef.current.load();
        
        // Add title if available
        if (clip.title && containerRef.current) {
          const titleElement = document.createElement('div');
          titleElement.className = styles.videoTitle;
          titleElement.textContent = clip.title;
          containerRef.current.appendChild(titleElement);
        }
        
        // Cleanup function
        return () => {
          if (videoRef.current) {
            videoRef.current.removeEventListener('canplay', handleCanPlay);
            videoRef.current.removeEventListener('playing', handlePlaying);
            videoRef.current.removeEventListener('pause', handlePause);
            videoRef.current.removeEventListener('ended', handleEnded);
            videoRef.current.removeEventListener('error', handleError);
            videoRef.current.removeEventListener('waiting', handleWaiting);
          }
        };
      } catch (error) {
        console.error('Error initializing player:', error);
        onPlayerEvent('error', 'Failed to initialize player');
        setError('Failed to load video. Please try downloading instead.');
      }
    };
    
    const cleanup = initializePlayer();
    
    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [clip, onPlayerEvent]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    } else {
      videoRef.current.pause();
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    
    if (videoRef.current) {
      // Try the alternative URL
      const currentUrl = videoRef.current.src;
      const directUrl = `https://videodelivery.net/${clip.cloudflare_uid}/downloads/default.mp4`;
      const streamUrl = `https://watch.videodelivery.net/${clip.cloudflare_uid}`;
      
      // Switch between URLs
      if (currentUrl.includes('videodelivery.net')) {
        videoRef.current.src = streamUrl;
        setVideoUrl(streamUrl);
      } else {
        videoRef.current.src = directUrl;
        setVideoUrl(directUrl);
      }
      
      videoRef.current.load();
    }
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
      ref={containerRef}
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
          <a 
            href={`https://videodelivery.net/${clip.cloudflare_uid}/downloads/default.mp4`}
            className={styles.downloadButton}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Video
          </a>
        </div>
      )}
      
      {!isPlaying && !isLoading && !error && (
        <div className={styles.playButtonOverlay} onClick={handlePlayPause}>
          <div className={styles.playButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}
      
      <video 
        ref={videoRef}
        className={styles.videoElement}
        playsInline
        controls
        controlsList="nodownload"
        onClick={handlePlayPause}
        crossOrigin="anonymous"
      />
      
      {/* Add a direct iframe fallback if all else fails */}
      {error && (
        <div className={styles.iframeContainer}>
          <iframe
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
          ></iframe>
        </div>
      )}
    </div>
  );
};

export default DynamicVideoPlayer;