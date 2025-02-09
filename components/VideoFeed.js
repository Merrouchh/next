import { useRef, useEffect, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import styles from '../styles/VideoFeed.module.css';

export const VideoFeed = ({ videos, onClipUpdate }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 5 });
  const feedRef = useRef(null);

  // Add throttled scroll handler
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!feedRef.current) return;
          
          const container = feedRef.current;
          const containerRect = container.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          
          // Calculate which videos should be visible
          const start = Math.max(0, Math.floor((containerRect.top * -1) / containerRect.height * videos.length));
          const end = Math.min(videos.length, Math.ceil((windowHeight - containerRect.top) / containerRect.height * videos.length));
          
          setVisibleRange({ start: Math.max(0, start - 1), end: end + 1 });
          ticking = false;
        });
      }
      ticking = true;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [videos.length]);

  return (
    <div ref={feedRef} className={styles.feedContainer}>
      {videos.map((video, index) => (
        <div 
          key={video.id}
          className={styles.videoItem}
          data-video-id={video.id}
          style={{
            minHeight: index < visibleRange.start || index > visibleRange.end ? '56.25vw' : 'auto'
          }}
        >
          {index >= visibleRange.start && index <= visibleRange.end ? (
            <VideoPlayer
              clip={video}
              onClipUpdate={onClipUpdate}
            />
          ) : (
            <div className={styles.videoPlaceholder} />
          )}
        </div>
      ))}
    </div>
  );
}; 