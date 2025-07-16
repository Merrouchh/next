import React from 'react';
import styles from '../../styles/TopUsers.module.css';

const ErrorMessage = React.memo(({ message, onRetry }) => {
  return (
    <div className={styles.errorContainer}>
      <p className={styles.error}>{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className={styles.retryButton}
          aria-label="Retry loading users"
        >
          Try Again
        </button>
      )}
    </div>
  );
});

ErrorMessage.displayName = 'ErrorMessage';

export default ErrorMessage; 