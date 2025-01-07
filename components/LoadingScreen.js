import React from 'react';
import styles from '../styles/LoadingScreen.module.css';

const LoadingScreen = ({ message = 'Loading...' }) => {
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingMessage}>{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;