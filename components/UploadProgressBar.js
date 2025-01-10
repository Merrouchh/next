import React, { useEffect, useState } from 'react';
import styles from '../styles/UploadProgressBar.module.css';

const UploadProgressBar = ({ progress }) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    // Smoothly update the progress
    const timer = setInterval(() => {
      setDisplayProgress(current => {
        if (current < progress) {
          return Math.min(current + 2, progress);
        }
        return progress;
      });
    }, 16); // Update roughly every frame (60fps)

    return () => clearInterval(timer);
  }, [progress]);

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${displayProgress}%` }}
        />
      </div>
      <span className={styles.progressText}>{Math.round(displayProgress)}%</span>
    </div>
  );
};

export default UploadProgressBar; 