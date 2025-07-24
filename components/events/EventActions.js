import React from 'react';
import Link from 'next/link';
import { FaSitemap, FaUserPlus } from 'react-icons/fa';
import { 
  getRegistrationButtonText, 
  getRegistrationButtonClass, 
  isRegistrationButtonDisabled 
} from '../../utils/eventDetailHelpers';
import TournamentWinner from '../shared/TournamentWinner';
import styles from '../../styles/EventDetail.module.css';

const EventActions = ({ 
  event, 
  registrationStatus, 
  isPublicView, 
  bracketState,
  onRegistrationClick,
  onCancelClick,
  onLoginClick,
  eventId
}) => {
  return (
    <section className={styles.registrationSection}>
      <h2 className={styles.sectionHeading}>
        <FaUserPlus /> Registration
      </h2>
      <div className={styles.eventActions}>
        {/* For completed events, don't show the gray "EVENT ENDED" button, 
            just show a nice tournament bracket button */}
        {event.status === 'Completed' ? (
          <div className={styles.endedEventActions}>
            {/* Display champions here when event is completed */}
            {bracketState.data && bracketState.data.bracket && (() => {
              // Find if there's a winner
              let winner = null;
              const matches = bracketState.data.bracket;
              const finalRound = matches[matches.length - 1];
              
              if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
                winner = bracketState.data.participants.find(p => p.id === finalRound[0].winnerId);
              }
              
              return winner && (
                <div className={styles.championsContainer}>
                  <TournamentWinner 
                    winner={winner} 
                    teamType={event.team_type} 
                    eventId={eventId} 
                  />
                </div>
              );
            })()}
            
            {/* Show regular bracket link if no champions data available */}
            {bracketState.data && bracketState.data.bracket && 
             !bracketState.data.bracket[bracketState.data.bracket.length - 1]?.[0]?.winnerId && (
              <Link 
                href={`/events/${eventId}/bracket`} 
                className={styles.tournamentBracketButton}
              >
                <FaSitemap className={styles.bracketIcon} /> View Tournament Bracket
              </Link>
            )}
          </div>
        ) : (
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
            
            {/* View Tournament Bracket button - for non-completed events */}
            {bracketState.data && bracketState.data.bracket && (
              <Link 
                href={`/events/${eventId}/bracket`} 
                className={`${styles.bracketButton} ${
                  (isPublicView && event.status !== 'Upcoming') ? styles.tournamentBracketButton : ''
                }`}
              >
                <FaSitemap className={styles.bracketIcon} /> View Tournament Bracket
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default EventActions; 