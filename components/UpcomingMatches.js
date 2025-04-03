import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Dashboard.module.css';
import sharedStyles from '../styles/Shared.module.css';
import { fetchUserUpcomingMatches } from '../utils/api';
import { AiOutlineTrophy, AiOutlineCalendar, AiOutlineEnvironment, AiOutlineClockCircle, AiOutlineReload } from 'react-icons/ai';

const UpcomingMatches = ({ userId }) => {
  const router = useRouter();
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasNoMatches, setHasNoMatches] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("User ID is required");
      return;
    }

    const loadUpcomingMatches = async () => {
      try {
        console.log(`Loading upcoming matches for user ${userId} (attempt ${retryCount + 1})`);
        setLoading(true);
        setError(null);
        
        const matches = await fetchUserUpcomingMatches(userId);
        setUpcomingMatches(matches);
        setHasNoMatches(matches.length === 0);
      } catch (err) {
        console.error('Error in UpcomingMatches component:', err);
        setError('Failed to load upcoming matches. You can try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    loadUpcomingMatches();
  }, [userId, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // Return null when there are no matches to render
  if (hasNoMatches && !loading && !error) {
    return null;
  }

  if (loading) {
    return (
      <div className={`${styles.statCard} ${styles.mediumCard}`}>
        <div className={styles.statHeader}>
          <div className={styles.statIcon}>
            <AiOutlineTrophy size={24} />
          </div>
          <h3 className={styles.statTitle}>Your Upcoming Matches</h3>
        </div>
        <div className={styles.loadingMatches}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Loading your matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.statCard} ${styles.mediumCard}`}>
        <div className={styles.statHeader}>
          <div className={styles.statIcon}>
            <AiOutlineTrophy size={24} />
          </div>
          <h3 className={styles.statTitle}>Your Upcoming Matches</h3>
        </div>
        <div className={styles.errorMatches}>
          <p>{error}</p>
          <button 
            className={sharedStyles.secondaryButton}
            onClick={handleRetry}
          >
            <AiOutlineReload className={sharedStyles.buttonIcon} />
            Retry
          </button>
        </div>
      </div>
    );
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
    <div className={`${styles.statCard} ${styles.mediumCard} ${sharedStyles.clickableCard}`}
      onClick={() => router.push('/events')}
      role="button"
      aria-label="View all upcoming matches"
    >
      <div className={styles.statHeader}>
        <div className={styles.statIcon}>
          <AiOutlineTrophy size={24} />
        </div>
        <h3 className={styles.statTitle}>Your Upcoming Matches</h3>
      </div>
      
      <div className={styles.upcomingMatchesList}>
        {displayMatches.map((match, index) => (
          <div key={`${match.eventId}_${match.matchId}`} className={styles.matchItem}>
            <div className={styles.matchEventInfo}>
              <span className={styles.eventTitle}>{match.eventTitle}</span>
              <span className={match.isReady ? styles.readyBadge : styles.notReadyBadge}>
                {match.isReady ? 'Ready to Play' : 'Waiting for Players'}
              </span>
            </div>
            
            <div className={styles.matchDetailsRow}>
              <div className={styles.matchRound}>
                <span className={styles.roundLabel}>{match.roundName}</span>
                <span className={styles.matchLabel}>Match #{match.matchId}</span>
              </div>
              
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
    </div>
  );
};

export default UpcomingMatches; 