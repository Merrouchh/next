import React from 'react';
import { AiOutlineDesktop } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import styles from '../../styles/Dashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';

const formatSessionCount = (activeCount) => {
  const totalCapacity = 14;
  return `${activeCount}/${totalCapacity}`;
};

const ActiveSessionsCard = React.memo(({ activeSessions, handleNavigation }) => {
  return (
    <DashboardCard 
      title="Active Sessions"
      icon={<AiOutlineDesktop size={24} />}
      className={`${styles.smallCard} ${sharedStyles.clickableCard}`}
      onClick={handleNavigation('/avcomputers?from=dashboard')}
      isClickable={true}
    >
      <div className={styles.sessionStats}>
        <div className={styles.sessionNumber}>
          {Array.isArray(activeSessions) ? formatSessionCount(activeSessions.length) : '0/14'}
        </div>
        <div className={styles.sessionLabel}>
          Active {(Array.isArray(activeSessions) && activeSessions.length === 1) ? 'Session' : 'Sessions'}
        </div>
      </div>
    </DashboardCard>
  );
});

ActiveSessionsCard.displayName = 'ActiveSessionsCard';

export default ActiveSessionsCard; 