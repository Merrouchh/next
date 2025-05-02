import React from 'react';
import { FaTrophy } from 'react-icons/fa';
import Link from 'next/link';
import styles from '../../styles/TournamentWinner.module.css';

/**
 * A reusable component to display tournament winners consistently across the app
 * 
 * @param {Object} props - Component props
 * @param {Object} props.winner - Winner data (can be registration ID or participant object)
 * @param {string} props.teamType - Event team type ('solo', 'duo', or 'team')
 * @param {boolean} props.showBadgeOnly - If true, only show a badge/label, no trophy or extra decoration
 * @param {boolean} props.isCompact - If true, use a more compact display
 * @param {boolean} props.hideLink - If true, hide the bracket link
 * @param {string} props.eventId - Optional event ID for linking to event
 * @param {string} props.className - Optional additional CSS class
 */
const TournamentWinner = ({ 
  winner, 
  teamType = 'solo',
  showBadgeOnly = false,
  isCompact = false,
  hideLink = false,
  eventId,
  className = '' 
}) => {
  if (!winner) return null;

  // Support both complete participant objects and simple winner data
  const winnerName = winner.name || winner.username || '';
  const teamName = winner.team_name || '';
  const hasTeamMembers = winner.members && winner.members.length > 0;
  
  // For duo events, show both team members if available
  const partnerName = hasTeamMembers ? winner.members[0]?.name : '';

  // For badge-only display (e.g. in profile achievements list)
  if (showBadgeOnly) {
    return (
      <span className={`${styles.winnerBadge} ${className}`}>
        Winner
      </span>
    );
  }

  // For compact display (e.g. in profile dashboard)
  if (isCompact) {
    return (
      <div className={`${styles.winnerCompact} ${className}`}>
        <FaTrophy className={styles.trophyIcon} />
        {teamType === 'team' && teamName ? (
          <span className={styles.winnerTeamName}>{teamName}</span>
        ) : teamType === 'duo' && partnerName ? (
          <span className={styles.winnerTeamName}>{winnerName} & {partnerName}</span>
        ) : (
          <span className={styles.winnerName}>{winnerName}</span>
        )}
      </div>
    );
  }

  // Default full display (e.g. in event details or bracket page)
  return (
    <div className={`${styles.tournamentWinner} ${className}`}>  
      {/* Trophy icon */}
      <div className={styles.trophy}>
        <FaTrophy />
      </div>
      <div className={styles.winnerInfo}>
        {teamType === 'team' && teamName ? (
          <>
            <h3 className={styles.championTitle}>Champion Team</h3>
            <div className={styles.winnerName}>{teamName}</div>
            {hasTeamMembers && (
              <div className={styles.teamMembers}>
                <span className={styles.captainName}>{winnerName}</span>
                {winner.members.map((member, index) => (
                  <span key={member.userId || index} className={styles.memberName}>
                    {member.name || member.username}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : teamType === 'duo' && partnerName ? (
          <>
            <h3 className={styles.championTitle}>Champions</h3>
            <div className={styles.winnerName}>{winnerName} & {partnerName}</div>
          </>
        ) : (
          <>
            <h3 className={styles.championTitle}>Champion</h3>
            <div className={styles.winnerName}>{winnerName}</div>
          </>
        )}
        
        {!hideLink && eventId && (
          <Link href={`/events/${eventId}/bracket`} className={styles.bracketLink}>
            View Bracket
          </Link>
        )}
      </div>
    </div>
  );
};

export default TournamentWinner; 