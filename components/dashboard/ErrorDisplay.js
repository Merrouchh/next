import React from 'react';
import { AiOutlineReload } from 'react-icons/ai';
import SessionRefreshButton from './SessionRefreshButton';
import styles from '../../styles/Dashboard.module.css';

const ErrorDisplay = React.memo(({ error }) => {
  return (
    <div className={styles.errorMessage}>
      <p>{error}</p>
      <div className={styles.contactInfo}>
        <p>You can reach us on:</p>
        <a 
          href="https://wa.me/212656053641" 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.whatsappLink}
        >
          WhatsApp: +212 656-053641
        </a>
      </div>
      <div className={styles.retryActions}>
        <button 
          onClick={() => window.location.reload()}
          className={styles.retryButton}
        >
          <AiOutlineReload /> Refresh Page
        </button>
        <SessionRefreshButton />
      </div>
    </div>
  );
});

ErrorDisplay.displayName = 'ErrorDisplay';

export default ErrorDisplay; 