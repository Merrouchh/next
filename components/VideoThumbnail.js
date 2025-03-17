import { useState, useEffect, useRef } from 'react';
import styles from '../styles/VideoThumbnail.module.css';
import { MdPlayCircle, MdMovie } from 'react-icons/md';

const VideoThumbnail = ({ file, onThumbnailGenerated, onError }) => {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSlowFile, setIsSlowFile] = useState(false);
  const [error, setError] = useState(false);
  const performanceTimerRef = useRef(null);
  const videoUrlRef = useRef(null);
  const thumbnailGeneratedRef = useRef(false);
  const attemptCountRef = useRef(0);
  const maxAttempts = 2;

  useEffect(() => {
    if (!file) {
      setThumbnail(null);
      setLoading(false);
      return;
    }

    // Skip thumbnail generation if we already have one for this file
    if (thumbnailGeneratedRef.current && thumbnail) {
      return;
    }

    // If we've already tried too many times, just show fallback
    if (attemptCountRef.current >= maxAttempts) {
      console.log('Max thumbnail generation attempts reached, using fallback');
      setLoading(false);
      setError(true);
      return;
    }

    attemptCountRef.current += 1;

    // Start performance timer to detect slow files (like network files)
    const startTime = performance.now();
    performanceTimerRef.current = setTimeout(() => {
      // If we're still loading after 1 second, it might be a network file
      if (loading) {
        setIsSlowFile(true);
        console.log('Slow file access detected, possibly a network file');
      }
    }, 1000);

    // Set a timeout to prevent UI freezing if generation takes too long
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('Thumbnail generation taking too long, using fallback');
        setLoading(false);
        setError(true);
        if (onError) {
          onError(new Error('Thumbnail generation timeout'));
        }
      }
    }, 5000); // 5 second timeout

    const generateThumbnail = async () => {
      try {
        // Check file size and skip processing for large files
        const MAX_SIZE_FOR_FULL_PROCESSING = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_SIZE_FOR_FULL_PROCESSING) {
          console.log('Large file detected, using simplified thumbnail generation');
          // For large files, we'll use a simpler approach
          setLoading(false);
          setError(true);
          return; // Skip processing, will show the fallback UI
        }

        // Check if this is likely a network file by measuring initial access time
        const accessTime = performance.now() - startTime;
        if (accessTime > 500) {
          // If initial file access took more than 500ms, it might be a network file
          console.log(`Slow file access detected (${Math.round(accessTime)}ms), possibly a network file`);
          setIsSlowFile(true);
          
          // For very slow files, we might want to skip thumbnail generation entirely
          if (accessTime > 2000) {
            console.log('Very slow file access, skipping thumbnail generation');
            setLoading(false);
            setError(true);
            return;
          }
        }

        // Create a temporary URL for the video file
        let videoUrl;
        try {
          const blobStartTime = performance.now();
          // Use a more reliable way to create blob URL
          const blob = new Blob([await file.arrayBuffer()], { type: file.type });
          videoUrl = URL.createObjectURL(blob);
          videoUrlRef.current = videoUrl; // Store for cleanup
          const blobTime = performance.now() - blobStartTime;
          
          // If creating the blob URL took a long time, it might be a network file
          if (blobTime > 300) {
            console.log(`Slow blob URL creation (${Math.round(blobTime)}ms), possibly a network file`);
            setIsSlowFile(true);
          }
        } catch (error) {
          console.log('Using fallback due to blob creation error');
          setLoading(false);
          setError(true);
          if (onError) {
            onError(new Error('Failed to create blob URL'));
          }
          return;
        }
        
        const video = document.createElement('video');
        
        // Set video properties
        video.src = videoUrl;
        video.preload = 'metadata'; // Only load metadata initially
        video.muted = true; // Required for autoplay
        video.playsInline = true;
        video.crossOrigin = 'anonymous'; // Try to avoid CORS issues

        // Add timeout for video loading
        const videoLoadPromise = new Promise((resolve, reject) => {
          const videoTimeout = setTimeout(() => {
            reject(new Error('Video loading timeout'));
          }, isSlowFile ? 10000 : 3000); // Longer timeout for slow files

          video.onloadedmetadata = () => {
            clearTimeout(videoTimeout);
            // Seek to 1 second or 25% of video duration, whichever is less
            const seekTime = Math.min(1, video.duration * 0.25);
            video.currentTime = seekTime;
          };

          video.onseeked = () => {
            clearTimeout(videoTimeout);
            resolve(video);
          };

          video.onerror = () => {
            clearTimeout(videoTimeout);
            reject(new Error('Video loading failed'));
          };
        });

        let videoElement;
        try {
          videoElement = await videoLoadPromise;
        } catch (error) {
          console.log('Using fallback due to video loading issue');
          // Clean up
          if (videoUrlRef.current) {
            URL.revokeObjectURL(videoUrlRef.current);
            videoUrlRef.current = null;
          }
          setLoading(false);
          setError(true);
          if (onError) {
            onError(new Error('Video preview not available'));
          }
          return;
        }

        // Create a canvas with reduced dimensions to save memory
        const MAX_DIMENSION = 320; // Limit thumbnail size
        const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
        
        let canvasWidth, canvasHeight;
        if (aspectRatio > 1) {
          canvasWidth = Math.min(MAX_DIMENSION, videoElement.videoWidth);
          canvasHeight = canvasWidth / aspectRatio;
        } else {
          canvasHeight = Math.min(MAX_DIMENSION, videoElement.videoHeight);
          canvasWidth = canvasHeight * aspectRatio;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Draw the current frame
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL with reduced quality for better performance
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        setThumbnail(thumbnailUrl);
        thumbnailGeneratedRef.current = true;
        
        if (onThumbnailGenerated) {
          onThumbnailGenerated(thumbnailUrl);
        }
        setLoading(false);
        setError(false);

        // Clean up video element
        video.src = '';
        video.load();
        
        // Clean up canvas
        canvas.width = 1; // Help garbage collection
        canvas.height = 1;
        
        // Clean up blob URL after thumbnail is generated
        if (videoUrlRef.current) {
          URL.revokeObjectURL(videoUrlRef.current);
          videoUrlRef.current = null;
        }

      } catch (error) {
        console.log('Using fallback due to thumbnail generation issue');
        setLoading(false);
        setError(true);
        if (onError) {
          onError(new Error('Thumbnail generation failed'));
        }
      }
    };

    // Start the thumbnail generation process
    generateThumbnail().finally(() => {
      clearTimeout(timeoutId);
      clearTimeout(performanceTimerRef.current);
    });

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(performanceTimerRef.current);
      
      // Clean up blob URL on unmount
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, [file, onThumbnailGenerated, onError, loading, thumbnail]);

  if (!file) return null;

  return (
    <div className={styles.thumbnailContainer}>
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>
            {isSlowFile 
              ? "Slow file access detected. Please wait..." 
              : "Generating preview..."}
          </span>
          {isSlowFile && (
            <small className={styles.slowFileWarning}>
              This may take longer for network files
            </small>
          )}
        </div>
      ) : error ? (
        <div className={styles.fallbackThumbnail}>
          <MdMovie className={styles.fallbackIcon} />
          <span className={styles.fallbackText}>
            {file.name.split('.').pop().toUpperCase()} Video
          </span>
        </div>
      ) : thumbnail ? (
        <div className={styles.thumbnailWrapper}>
          <img 
            src={thumbnail} 
            alt="Video thumbnail" 
            className={styles.thumbnail}
            onError={() => {
              setError(true);
              if (onError) onError(new Error('Failed to load thumbnail'));
            }}
          />
          <div className={styles.overlay}>
            <MdPlayCircle className={styles.playIcon} />
          </div>
        </div>
      ) : (
        <div className={styles.fallbackThumbnail}>
          <MdMovie className={styles.fallbackIcon} />
          <span className={styles.fallbackText}>
            {file.name.split('.').pop().toUpperCase()} Video
          </span>
        </div>
      )}
    </div>
  );
};

export default VideoThumbnail; 