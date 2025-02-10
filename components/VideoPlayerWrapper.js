/* eslint-disable react/display-name */
import React from 'react';
import dynamic from 'next/dynamic';
import styles from '../styles/VideoPlayer.module.css';
import LoadingScreen from './LoadingScreen';

// Create a loading component using LoadingScreen
const LoadingPlaceholder = () => (
  <div className={styles.playerContainer}>
    <div className={styles.videoPlayerWrapper}>
      <div className={styles.loadingWrapper}>
        <LoadingScreen message="Loading player..." type="content" />
      </div>
    </div>
  </div>
);

// Import VideoPlayer with dynamic import and no SSR
const VideoPlayer = dynamic(
  () => import('./VideoPlayer').then((mod) => {
    const VideoPlayerComponent = mod.default;
    return (props) => (
      <div className={styles.videoPlayerWrapper}>
        <VideoPlayerComponent {...props} />
      </div>
    );
  }),
  {
    ssr: false,
    loading: LoadingPlaceholder
  }
);

const VideoPlayerWrapper = (props) => {
  // Use useEffect to handle client-side mounting
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Return the same markup structure whether mounted or not
  return (
    <div className={styles.playerContainer}>
      <div className={styles.videoPlayerWrapper}>
        {isMounted ? (
          <VideoPlayer {...props} />
        ) : (
          <div className={styles.loadingWrapper}>
            <LoadingScreen message="Loading player..." type="content" />
          </div>
        )}
      </div>
    </div>
  );
};

// Add this line to set the display name
VideoPlayerWrapper.displayName = 'VideoPlayerWrapper';

export default VideoPlayerWrapper; 