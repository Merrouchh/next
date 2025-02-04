import { useEffect, useState } from 'react';
import { MdPlayArrow } from 'react-icons/md';
import styles from '../styles/VideoThumbnail.module.css';

const VideoThumbnail = ({ file, onThumbnailGenerated, onError, width = 320, height = 180, quality = 0.8 }) => {
    const [thumbnailUrl, setThumbnailUrl] = useState(null);
    const [error, setError] = useState(null);
  
    useEffect(() => {
      if (!file) return;
  
      let mounted = true;
      let videoUrl = null;
      const video = document.createElement('video');
  
      const cleanup = () => {
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
          videoUrl = null;
        }
        video.onloadedmetadata = null;
        video.onerror = null;
        video.onseeked = null;
        video.src = '';
        video.remove();
      };
  
      try {
        // Set up video element
        video.preload = 'metadata';
        video.playsInline = true;
        video.muted = true;
  
        const generateThumbnail = () => {
          if (!mounted) return;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
  
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', quality);
            if (mounted) {
              setThumbnailUrl(thumbnail);
              if (onThumbnailGenerated) onThumbnailGenerated(thumbnail);
            }
          } catch (err) {
            if (mounted) {
              console.warn('Thumbnail generation failed:', err);
              setError('Could not generate preview');
              if (onError) onError(err);
            }
          } finally {
            canvas.remove();
          }
        };
  
        // Handle metadata loaded
        video.onloadedmetadata = () => {
          if (mounted) video.currentTime = 0.1;
        };
  
        // Handle seeking complete
        video.onseeked = generateThumbnail;
  
        // Handle errors
        video.onerror = (e) => {
          if (mounted) {
            console.warn('Video loading failed:', e);
            setError('Preview not available');
            if (onError) onError(e);
          }
          cleanup();
        };
  
        // Set source last
        videoUrl = URL.createObjectURL(file);
        video.src = videoUrl;
  
      } catch (err) {
        if (mounted) {
          console.error('Setup failed:', err);
          setError('Could not setup preview');
          if (onError) onError(err);
        }
        cleanup();
      }
  
      return () => {
        mounted = false;
        cleanup();
      };
    }, [file, width, height, quality, onThumbnailGenerated, onError]);
  
    if (error) {
      return (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      );
    }
  
    if (!thumbnailUrl) {
      return (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading preview...</p>
        </div>
      );
    }
  
    return (
      <div className={styles.preview}>
        <img 
          src={thumbnailUrl} 
          alt="Video preview" 
          className={styles.thumbnailImage}
        />
        <div className={styles.playIcon}>
          <MdPlayArrow />
        </div>
      </div>
    );
  };
  

export default VideoThumbnail; 