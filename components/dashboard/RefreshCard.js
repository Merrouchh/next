import React from 'react';
import { AiOutlineReload } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import styles from '../../styles/Dashboard.module.css';
// import sharedStyles from '../../styles/Shared.module.css'; // Removed unused import

const RefreshCard = React.memo(({ onRefresh, isLoading }) => {
  return (
    <DashboardCard 
      title="Refresh Data"
      icon={<AiOutlineReload size={24} />}
      className={styles.mediumCard}
    >
      <div className={styles.refreshCardContent}>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className={`${styles.refreshButton} ${isLoading ? styles.refreshing : ''}`}
          aria-label="Refresh dashboard data"
        >
          <AiOutlineReload className={styles.refreshIcon} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </DashboardCard>
  );
});

RefreshCard.displayName = 'RefreshCard';

export default RefreshCard; 