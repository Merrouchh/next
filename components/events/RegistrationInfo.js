import React from 'react';
import styles from '../../styles/EventDetail.module.css';

const RegistrationInfo = ({ event, registrationStatus }) => {
  // Don't show for non-upcoming events or when loading
  if (event.status !== 'Upcoming' || registrationStatus.isLoading) {
    return null;
  }

  // For completed events, always show as full (UI "cheat" to display properly)
  // Note: This component only shows for Upcoming events, but keeping logic for consistency
  const displayCount = event.status === 'Completed' && registrationStatus.registrationLimit !== null
    ? registrationStatus.registrationLimit
    : registrationStatus.registeredCount;

  // Only show progress bar if there's a registration limit
  if (registrationStatus.registrationLimit === null) {
    return null;
  }

  return (
    <div className={styles.registrationInfo}>
      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar}
          style={{ 
            width: `${Math.min(100, (displayCount / registrationStatus.registrationLimit) * 100)}%`,
            backgroundColor: displayCount >= registrationStatus.registrationLimit ? 
              '#dc3545' : '#28a745'
          }}
        ></div>
      </div>
    </div>
  );
};

// Loading component for registration info
export const RegistrationInfoLoading = ({ event, registrationStatus }) => {
  // Only show loading for upcoming events when isLoading is true
  if (event.status !== 'Upcoming' || !registrationStatus.isLoading) {
    return null;
  }

  return (
    <div className={styles.registrationInfoLoading}>
      <div className={styles.loadingPulse}></div>
    </div>
  );
};

export default RegistrationInfo; 