import React from 'react';
import { formatDate } from '../../utils/eventDetailHelpers';
import styles from '../../styles/EventDetail.module.css';

const EventHeader = ({ event, registrationStatus, isPublicView, teamState }) => {
  return (
    <div className={styles.eventHeader}>
      <div className={styles.eventImageContainer}>
        {event.image ? (
          <img 
            src={event.image} 
            alt={event.title} 
            className={styles.eventImage}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentNode.classList.add(styles.fallbackImage);
            }}
          />
        ) : (
          <div className={styles.eventImagePlaceholder}>
            <div className={styles.placeholderText}>{event.title.charAt(0).toUpperCase()}</div>
          </div>
        )}
        <div className={`${styles.eventStatusBadge} ${styles[`status${event.status?.replace(/\s+/g, '')}`]}`}>
          {event.status || 'Upcoming'}
        </div>
      </div>
      <div className={styles.eventInfo}>
        <h1 className={styles.eventTitle}>{event.title}</h1>
        
        {/* Registration status indicator - only for authenticated users */}
        {!isPublicView && registrationStatus.isRegistered && (
          <div className={styles.registrationStatusIndicator}>
            {registrationStatus.registeredBy ? (
              <span className={styles.registeredByIndicator}>
                <span className={styles.checkIcon}>✓</span> Registered by {registrationStatus.registeredBy}
              </span>
            ) : (
              <span className={styles.registeredIndicator}>
                <span className={styles.checkIcon}>✓</span> Registered for this event
              </span>
            )}
          </div>
        )}
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Date:</span>
          <span>{event.date ? formatDate(event.date) : 'TBD'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Time:</span>
          <span>{event.time || 'TBD'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Location:</span>
          <span>{event.location || 'TBD'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Game:</span>
          <span>{event.game || 'TBD'}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Team Type:</span>
          <span>
            {event.team_type === 'solo' ? 'Solo (Individual)' : 
             event.team_type === 'duo' ? 'Duo (2 Players)' : 
             'Team (Multiple Players)'}
          </span>
        </div>
        
        {/* Duo/team member info - only for authenticated users */}
        {!isPublicView && teamState.teamType === 'duo' && registrationStatus.isRegistered && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Duo Partner:</span>
            <span className={styles.partnerName}>
              {registrationStatus.registeredBy ? (
                <>{registrationStatus.registeredBy}</>
              ) : registrationStatus.teamMembers.length > 0 ? (
                <>{registrationStatus.teamMembers[0].username}</>
              ) : (
                'None'
              )}
            </span>
          </div>
        )}
        
        {/* Team members in event details - only for authenticated users */}
        {!isPublicView && teamState.teamType === 'team' && registrationStatus.isRegistered && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Team Members:</span>
            <div className={styles.teamMembersInline}>
              {registrationStatus.registeredBy ? (
                <span className={styles.partnerName}>
                  {registrationStatus.registeredBy} (Team Leader)
                </span>
              ) : (
                <span className={styles.teamLeaderBadge}>You (Team Leader)</span>
              )}
              
              {registrationStatus.teamMembers.length > 0 && (
                <div className={styles.teamMembersChips}>
                  {registrationStatus.teamMembers.map(member => (
                    <span key={member.user_id} className={styles.teamMemberChip}>
                      {member.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Registrations:</span>
          <span>
            {registrationStatus.registeredCount}
            {registrationStatus.registrationLimit !== null && 
              ` / ${registrationStatus.registrationLimit}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EventHeader; 