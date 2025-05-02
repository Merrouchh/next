import { FaUsers } from 'react-icons/fa';
import styles from '../../styles/Bracket.module.css';

const ParticipantsList = ({ participants, eventType }) => {
  if (!participants || participants.length === 0) return null;

  // Group participants by type for better layout
  const duoParticipants = eventType === 'duo' ? participants : [];
  const teamParticipants = eventType === 'team' ? participants : [];
  const soloParticipants = eventType === 'solo' ? participants : [];

  return (
    <div className={styles.participantsSection}>
      <h3>
        <FaUsers className={styles.participantsIcon} />
        Participants ({participants.length})
      </h3>
      
      <div className={styles.participantsList}>
        {/* Render solo participants */}
        {soloParticipants.map((participant, index) => (
          <div key={`participant-${participant.id}`} className={`${styles.participantItem} ${styles.soloItem}`}>
            <span className={styles.participantNumber}>{index + 1}</span>
            <div className={styles.participantInfo}>
              <span className={styles.participantName}>{participant.name}</span>
            </div>
          </div>
        ))}
        
        {/* Render team participants */}
        {teamParticipants.map((participant, index) => {
          // Check if this is a team with multiple members
          const isTeam = participant.members && participant.members.length > 0;
          const teamName = participant.team_name || participant.name;
          
          return (
            <div key={`participant-${participant.id}`} className={`${styles.participantItem} ${styles.teamItem}`}>
              <span className={styles.participantNumber}>{index + 1}</span>
              <div className={styles.participantInfo}>
                <div className={styles.teamHeader}>
                  <span className={styles.teamNameLarge}>{teamName}</span>
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
        
        {/* Render duo participants */}
        {duoParticipants.map((participant, index) => {
          // Get partner info for duo events
          const hasPartner = (participant.members && participant.members.length > 0) || participant.partner;
          
          // Get partner name from either members array or partner property
          const partnerName = hasPartner ? 
            (participant.members && participant.members.length > 0 ? 
              participant.members[0]?.name : participant.partner) : null;
              
          return (
            <div key={`participant-${participant.id}`} className={styles.participantItem}>
              <span className={styles.participantNumber}>{index + 1}</span>
              <div className={styles.participantInfo}>
                {participant.team_name ? (
                  <>
                    {/* Display team name alone if it's the same as one of the usernames */}
                    <div className={styles.teamNameLarge}>{participant.team_name}</div>
                    
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
                  /* Only show usernames if no team name */
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantsList; 