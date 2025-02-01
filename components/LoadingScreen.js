import React, { useEffect, useState } from 'react';
import styles from '../styles/LoadingScreen.module.css';

const LoadingScreen = ({ message = 'Loading...', type }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a consistent default message
  const displayMessage = message || 'Loading...';
  
  // Create className based on mounted state and type
  const containerClassName = `${styles.loadingContainer} ${mounted ? styles.mounted : ''} ${
    type === 'content' ? styles.contentOnly : styles.auth
  }`;

  return (
    <div className={containerClassName}>
      <div className={styles.loadingSpinner}>
        <div></div>
      </div>
      <p className={styles.loadingMessage}>{displayMessage}</p>
    </div>
  );
};

export default LoadingScreen;