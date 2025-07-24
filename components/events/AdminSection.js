import React from 'react';
import Link from 'next/link';
import { FaSitemap } from 'react-icons/fa';
import styles from '../../styles/EventDetail.module.css';

const AdminSection = ({ 
  user, 
  event, 
  bracketState,
  onGenerateBracket,
  onDeleteBracket
}) => {
  // Only show for admin users
  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className={styles.adminSection}>
      <h3>Admin Controls</h3>
      <div className={styles.adminButtonsContainer}>
        <div className={styles.adminButtonGroup}>
          <h4>Event Management</h4>
          <Link href={`/admin/events?edit=${event.id}`} className={styles.adminEditButton}>
            <span>✏️</span> Edit Event Details
          </Link>
        </div>
        
        <div className={styles.adminButtonGroup}>
          <h4>Registration Management</h4>
          <Link href={`/admin/events/registrations/${event.id}`} className={styles.viewRegistrationsButton}>
            <span>👥</span> View All Registrations
          </Link>
        </div>
        
        <div className={styles.adminButtonGroup}>
          <h4>Tournament Bracket</h4>
          {!bracketState.data || !bracketState.data.bracket ? (
            <button 
              className={styles.generateBracketButton}
              onClick={onGenerateBracket}
              disabled={bracketState.loading}
            >
              <FaSitemap className={styles.bracketIcon} />
              Generate Tournament Bracket
            </button>
          ) : (
            <button 
              className={styles.deleteBracketButton}
              onClick={onDeleteBracket}
              disabled={bracketState.loading}
            >
              Delete Tournament Bracket
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSection; 