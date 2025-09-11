import React from 'react';
import { useRouter } from 'next/router';
import { AiOutlineTrophy, AiOutlineClockCircle, AiOutlineEnvironment } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import styles from '../../styles/Dashboard.module.css';

const UpcomingMatchesCard = ({ upcomingMatches = [] }) => {
  const router = useRouter();

  // Don't render if no matches
  if (!upcomingMatches || upcomingMatches.length === 0) {
    return null;
  }

  // Format date in a user-friendly way
  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'TBD';
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'TBD';
    }
  };

  // Only show the first few matches
  const displayMatches = upcomingMatches.slice(0, 3);
  const hasMoreMatches = upcomingMatches.length > 3;

  return (
    <DashboardCard 
      title="Your Upcoming Matches"
      icon={<AiOutlineTrophy size={24} />}
      className={styles.mediumCard}
    >
      <div className={styles.upcomingMatchesList}>
        {displayMatches.map((match) => (
          <div 
            key={`${match.eventId}_${match.matchId}`} 
            className={`${styles.matchItem} ${styles.clickableMatch}`}
            onClick={() => router.push(`/events/${match.eventId}/bracket`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(`/events/${match.eventId}/bracket`);
              }
            }}
            aria-label={`View bracket for ${match.eventTitle}`}
          >
            <div className={styles.matchEventInfo}>
              <span className={styles.eventTitle}>{match.eventTitle}</span>
              <span className={match.isReady ? styles.readyBadge : styles.notReadyBadge}>
                {match.isReady ? 'Ready to Play' : 'Waiting for Players'}
              </span>
            </div>
            
            <div className={styles.matchRound}>
              <span className={styles.roundLabel}>{match.roundName}</span>
              <span className={styles.matchLabel}>Match #{match.matchId}</span>
            </div>
            
            <div className={styles.matchupInfo}>
              {match.notes && (
                <div className={styles.matchNotes}>
                  <span className={styles.notesLabel}>Notes:</span>
                  <span className={styles.notesText}>{match.notes}</span>
                </div>
              )}
              <div className={styles.opponentInfo}>
                <span className={styles.vsLabel}>VS</span>
                <span className={styles.opponentName}>{match.opponentName}</span>
              </div>
            </div>
            
            {match.scheduledTime && (
              <div className={styles.matchScheduleInfo}>
                <span className={styles.scheduleIcon}>
                  <AiOutlineClockCircle size={14} />
                </span>
                <span className={styles.scheduleTime}>
                  {formatDate(match.scheduledTime)}
                </span>
                
                {match.location && (
                  <>
                    <span className={styles.locationIcon}>
                      <AiOutlineEnvironment size={14} />
                    </span>
                    <span className={styles.locationLabel}>{match.location}</span>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        
        {hasMoreMatches && (
          <div className={styles.moreMatchesIndicator}>
            +{upcomingMatches.length - 3} more matches scheduled
          </div>
        )}
      </div>
    </DashboardCard>
  );
};

export default UpcomingMatchesCard; 