import { FaUsers } from 'react-icons/fa';
import styles from '../../styles/Bracket.module.css';
import { getParticipantDisplayName } from '../../utils/participantUtils';

const ParticipantsList = ({ participants, eventType }) => {
  if (!participants || participants.length === 0) return null;

  return (
    <div className={styles.participantsSection}>
      <h3>
        <FaUsers className={styles.participantsIcon} />
        Participants ({participants.length})
      </h3>
      
      <div className={styles.participantsList}>
        {/* Render solo participants */}
        {eventType === 'solo' && participants.map((participant, index) => (
          <div key={`participant-${participant.id}`} className={`${styles.participantItem} ${styles.soloItem}`}>
            <span className={styles.participantNumber}>{index + 1}</span>
            <div className={styles.participantInfo}>
              {getParticipantDisplayName(participant, eventType, {
                format: 'jsx',
                className: styles.participantName,
                styles: { participantName: styles.participantName }
              })}
            </div>
          </div>
        ))}
        
        {/* Render team participants with detailed member info */}
        {eventType === 'team' && participants.map((participant, index) => {
          // Check if this is a team with multiple members
          const isTeam = participant.members && participant.members.length > 0;
          
          return (
            <div key={`participant-${participant.id}`} className={`${styles.participantItem} ${styles.teamItem}`}>
              <span className={styles.participantNumber}>{index + 1}</span>
              <div className={styles.participantInfo}>
                <div className={styles.teamHeader}>
                  {getParticipantDisplayName(participant, eventType, {
                    format: 'jsx',
                    className: styles.teamNameLarge,
                    styles: { teamName: styles.teamNameLarge }
                  })}
                  <span className={styles.captainBadge}>Captain: {participant.name}</span>
                </div>
                
                <div className={styles.teamMembers}>
                  <div className={styles.teamMembersTitle}>Team Members:</div>
                  {isTeam ? (
                    participant.members.map(member => (
                      <span key={`member-${member.userId || member.id}`} className={styles.teamMember}>
                        {member.name || member.username}
                      </span>
                    ))
                  ) : (
                    <span className={styles.noMembers}>No additional members</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Render duo participants with detailed partner info */}
        {eventType === 'duo' && participants.map((participant, index) => {
          // Get partner info for duo events
          const hasPartner = (participant.members && participant.members.length > 0) || participant.partner;
          
          // Get partner name from either members array or partner property
          const partnerName = hasPartner ? 
            (participant.members && participant.members.length > 0 ? 
              participant.members[0]?.name || participant.members[0]?.username : participant.partner) : null;
              
          return (
            <div key={`participant-${participant.id}`} className={styles.participantItem}>
              <span className={styles.participantNumber}>{index + 1}</span>
              <div className={styles.participantInfo}>
                {participant.team_name ? (
                  <>
                    {/* Display team name using centralized utility */}
                    {getParticipantDisplayName(participant, eventType, {
                      format: 'jsx',
                      className: styles.teamNameLarge,
                      styles: { teamName: styles.teamNameLarge },
                      showPartnerNames: false // Only show team name, not individual names
                    })}
                    
                    {/* Only display the usernames if they're different from the team name */}
                    {(participant.team_name.toLowerCase() !== participant.name.toLowerCase() && 
                      (!partnerName || participant.team_name.toLowerCase() !== partnerName.toLowerCase())) && (
                      <div className={styles.duoParticipantNames}>
                        <span className={styles.participantName}>{participant.name}</span>
                        {hasPartner && (
                          <>
                            <span className={styles.duoSeparator}>&</span>
                            <span className={styles.participantName}>{partnerName}</span>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Only show usernames if no team name - using centralized utility */
                  getParticipantDisplayName(participant, eventType, {
                    format: 'jsx',
                    className: styles.duoParticipantNames,
                    styles: {
                      duoNames: styles.duoParticipantNames,
                      separator: styles.duoSeparator,
                      participantName: styles.participantName
                    }
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantsList; 