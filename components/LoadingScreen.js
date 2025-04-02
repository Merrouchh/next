import React from 'react';
import styles from '../styles/LoadingScreen.module.css';

const LoadingScreen = ({ message = 'Loading...', type = 'default' }) => {
  // Different styling based on the type
  const containerClass = `${styles.container} ${
    type === 'verification' ? styles.verificationContainer : 
    type === 'auth' ? styles.authContainer : 
    styles.defaultContainer
  }`;

  return (
    <div className={containerClass}>
      <div className={styles.content}>
        {type === 'verification' ? (
          <div className={styles.verificationIcon}>✓</div>
        ) : (
          <div className={styles.spinner}></div>
        )}
        <p className={styles.message}>{message}</p>
        {type === 'verification' && (
          <p className={styles.subMessage}>Please wait while we process your verification</p>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;