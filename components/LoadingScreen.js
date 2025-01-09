import React from 'react';
import styles from '../styles/LoadingScreen.module.css';

const LoadingScreen = ({ message = 'Loading...', type = 'auth' }) => {
  return (
    <div className={`${styles.loadingScreen} ${styles[type]}`}>
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingMessage}>{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;