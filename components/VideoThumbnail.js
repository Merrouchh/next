import { useState, useEffect } from 'react';
import styles from '../styles/VideoThumbnail.module.css';
import { MdPlayCircle } from 'react-icons/md';

const VideoThumbnail = ({ file, onThumbnailGenerated, onError }) => {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!file) {
      setThumbnail(null);
      setLoading(false);
      return;
    }

    const generateThumbnail = async () => {
      try {
        // Create a temporary URL for the video file
        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        
        // Set video properties
        video.src = videoUrl;
        video.preload = 'metadata';
        video.muted = true; // Required for autoplay
        video.playsInline = true;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => {
            // Seek to 1 second or 25% of video duration, whichever is less
            const seekTime = Math.min(1, video.duration * 0.25);
            video.currentTime = seekTime;
          };

          video.onseeked = () => {
            // Create a canvas to capture the thumbnail
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw the current frame
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to data URL
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
            setThumbnail(thumbnailUrl);
            if (onThumbnailGenerated) {
              onThumbnailGenerated(thumbnailUrl);
            }
            setLoading(false);
            resolve();
          };

          video.onerror = (error) => {
            if (onError) {
              onError(error);
            }
            console.error('Error loading video:', error);
            setLoading(false);
            reject(error);
          };
        });

        // Clean up
        URL.revokeObjectURL(videoUrl);

      } catch (error) {
        console.error('Error generating thumbnail:', error);
        setLoading(false);
        if (onError) {
          onError(error);
        }
      }
    };

    generateThumbnail();
  }, [file, onThumbnailGenerated, onError]);

  if (!file) return null;

  return (
    <div className={styles.thumbnailContainer}>
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Generating preview...</span>
        </div>
      ) : thumbnail ? (
        <div className={styles.thumbnailWrapper}>
          <img 
            src={thumbnail} 
            alt="Video thumbnail" 
            className={styles.thumbnail}
            onError={() => {
              if (onError) onError(new Error('Failed to load thumbnail'));
            }}
          />
          <div className={styles.overlay}>
            <MdPlayCircle className={styles.playIcon} />
          </div>
        </div>
      ) : (
        <div className={styles.fallback}>
          <MdPlayCircle className={styles.playIcon} />
          <span>Preview not available</span>
        </div>
      )}
    </div>
  );
};

export default VideoThumbnail; 