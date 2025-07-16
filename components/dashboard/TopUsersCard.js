import React from 'react';
import { AiOutlineTrophy } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import styles from '../../styles/Dashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';

const getMedalEmoji = (index) => {
  switch (index) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return '';
  }
};

const TopUsersCard = React.memo(({ topUsers, handleNavigation }) => {
  return (
    <DashboardCard 
      title="Top Players"
      icon={<AiOutlineTrophy size={24} />}
      className={`${styles.mediumCard} ${sharedStyles.clickableCard}`}
      onClick={handleNavigation('/topusers')}
      isClickable={true}
    >
      <ul className={styles.topUsersList}>
        {topUsers?.map((user, index) => (
          <li key={index} className={styles.topUserItem}>
            <span className={styles.topUserRank}>{index + 1}</span>
            <span className={styles.topUserName}>{user.name || user.username}</span>
            <span className={styles.topUserMedal}>{getMedalEmoji(index)}</span>
          </li>
        )) || (
          <li className={styles.noDataMessage}>No top players available</li>
        )}
      </ul>
    </DashboardCard>
  );
});

TopUsersCard.displayName = 'TopUsersCard';

export default TopUsersCard; 