import React from 'react';
import { FaUserPlus } from 'react-icons/fa';
import { 
  getRegistrationButtonText, 
  getRegistrationButtonClass, 
  isRegistrationButtonDisabled 
} from '../../utils/eventDetailHelpers';
import ChampionBanner from '../ChampionBanner';
import styles from '../../styles/EventDetail.module.css';

const EventActions = ({ 
  event, 
  registrationStatus, 
  isPublicView, 
  bracketState,
  onRegistrationClick,
  onCancelClick,
  onLoginClick
}) => {
  return (
    <section className={styles.registrationSection}>
      {/* Don't show registration section for completed events */}
      {event.status !== 'Completed' && (
        <h2 className={styles.sectionHeading}>
          <FaUserPlus /> Registration
        </h2>
      )}
      <div className={styles.eventActions}>
        {/* For completed events, don't show the gray "EVENT ENDED" button, 
            just show a nice tournament bracket button */}
        {event.status === 'Completed' ? (
          <div className={styles.endedEventActions}>
            {/* Display champions here when event is completed */}
            {bracketState.data && bracketState.data.bracket && (
              <ChampionBanner 
                bracketData={bracketState.data}
                event={event}
                eventType={event.team_type}
              />
            )}
            
          </div>
        ) : (
          <>
            {/* Don't show registration section for completed events */}
            {event.status !== 'Completed' && (
              <>
                {/* Login prompt for public users - only for upcoming events */}
                {isPublicView && event.status === 'Upcoming' && (
                  <div className={styles.loginPrompt}>
                    <p>Please log in to register for this event</p>
                    <button onClick={onLoginClick} className={styles.loginButton}>
                      Login
                    </button>
                  </div>
                )}
                
                {/* Status message for in-progress events - for public users */}
                {isPublicView && event.status === 'In Progress' && (
                  <div className={styles.eventStatusMessage}>
                    <p>This event is currently in progress</p>
                  </div>
                )}
                
                {/* Registration/Cancel buttons - only for authenticated users */}
                {!isPublicView && (
                  <>
                    {/* Only show registration button if user is NOT registered */}
                    {!registrationStatus.isRegistered ? (
                      <button 
                        className={getRegistrationButtonClass(event, registrationStatus, styles)}
                        onClick={onRegistrationClick}
                        disabled={isRegistrationButtonDisabled(event, registrationStatus)}
                      >
                        {getRegistrationButtonText(event, registrationStatus, isPublicView)}
                      </button>
                    ) : null}
                    
                    {/* Show cancel button ONLY if: 
                      1. User is registered 
                      2. User is the main registrant (not added by someone else)
                      3. Event is still upcoming (not in progress or completed)
                    */}
                    {registrationStatus.isRegistered && 
                     !registrationStatus.registeredBy && 
                     event.status === 'Upcoming' && (
                      <button 
                        className={`${styles.registerButton} ${styles.cancelButton}`}
                        onClick={onCancelClick}
                        disabled={registrationStatus.isLoading}
                      >
                        Cancel Registration
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            
            {/* Show completion message for completed events */}
            {event.status === 'Completed' && (
              <div className={styles.eventCompletedMessage}>
                <p>This event has been completed</p>
              </div>
            )}
            
          </>
        )}
      </div>
    </section>
  );
};

export default EventActions; 