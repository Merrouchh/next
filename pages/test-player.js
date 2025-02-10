import React from 'react';
import VideoPlayerWrapper from '../components/VideoPlayerWrapper';
import styles from '../styles/VideoPlayer.module.css';

const TestPlayerPage = () => {
  const testClip = {
    id: 'test-1',
    title: 'Test HLS Stream',
    username: 'Test User',
    file_path: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    views_count: 0,
    likes_count: 0,
    visibility: 'public',
    game: 'Test Game'
  };

  return (
    <div className={styles.pageContainer}>
      <h1>Video Player Test</h1>
      <VideoPlayerWrapper 
        clip={testClip}
        user={null}
        showActions={true}
        showHeader={true}
      />
    </div>
  );
};

export default TestPlayerPage; 