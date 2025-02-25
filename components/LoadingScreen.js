import React, { useEffect, useState } from 'react';
import styles from '../styles/LoadingScreen.module.css';

const LoadingScreen = ({ message = 'Loading...', type }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Create className based on mounted state and type
  const containerClassName = `${styles.loadingContainer} ${mounted ? styles.mounted : ''} ${
    type === 'content' ? styles.contentOnly : styles.auth
  }`;

  // Always return the same structure regardless of mounted state
  return (
    <div className={containerClassName} suppressHydrationWarning>
      <div className={styles.loadingWrapper}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingSpinner}>
            <div className={styles.spinnerInner} />
          </div>
          <div className={styles.loadingText}>
            <p className={styles.loadingMessage}>{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;