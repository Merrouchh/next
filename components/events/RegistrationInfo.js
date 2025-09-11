import React from 'react';
import styles from '../../styles/EventDetail.module.css';

const RegistrationInfo = ({ event, registrationStatus }) => {
  // Don't show for non-upcoming events or when loading
  if (event.status !== 'Upcoming' || registrationStatus.isLoading) {
    return null;
  }

  return (
    <div className={styles.registrationInfo}>
      <h3>Registration Information</h3>
      {registrationStatus.registrationLimit !== null ? (
        <p>
          {registrationStatus.registeredCount} out of {registrationStatus.registrationLimit} spots filled
          {registrationStatus.registeredCount >= registrationStatus.registrationLimit ? 
            ' (Registration is full)' : ''}
        </p>
      ) : (
        <p>
          {registrationStatus.registeredCount} {registrationStatus.registeredCount === 1 ? 'person has' : 'people have'} registered for this event
        </p>
      )}
      
      {/* Show duo partner information if available */}
      {event.team_type === 'duo' && registrationStatus.isRegistered && registrationStatus.partnerInfo && (
        <div className={styles.duoPartnerInfo}>
          <p><strong>Duo Partner:</strong> {registrationStatus.partnerInfo.username}</p>
        </div>
      )}
      
      {/* Show "Waiting for partner" if it's a duo event but no partner found */}
      {event.team_type === 'duo' && registrationStatus.isRegistered && !registrationStatus.partnerInfo && (
        <div className={styles.duoPartnerInfo}>
          <p><strong>Duo Partner:</strong> <span style={{color: '#ffc107'}}>Waiting for partner to register</span></p>
        </div>
      )}
      
      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar}
          style={{ 
            width: registrationStatus.registrationLimit !== null ? 
              `${Math.min(100, (registrationStatus.registeredCount / registrationStatus.registrationLimit) * 100)}%` : 
              '100%',
            backgroundColor: registrationStatus.registeredCount >= registrationStatus.registrationLimit ? 
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