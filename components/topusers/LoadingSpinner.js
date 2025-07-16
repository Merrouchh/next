import React from 'react';
import styles from '../../styles/TopUsers.module.css';

const LoadingSpinner = React.memo(({ message = 'Loading users...' }) => {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}>
        <div className={styles.spinnerInner}></div>
      </div>
      <p className={styles.loadingText}>{message}</p>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner; 