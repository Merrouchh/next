import React from 'react';
import { AiOutlineReload } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import styles from '../../styles/Dashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';

const RefreshCard = React.memo(({ onRefresh, isLoading }) => {
  return (
    <DashboardCard 
      title="Refresh Data"
      icon={<AiOutlineReload size={24} />}
      className={styles.smallCard}
    >
      <div className={sharedStyles.centeredButtonContainer}>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className={`${sharedStyles.primaryButton} ${isLoading ? styles.refreshing : ''}`}
          aria-label="Refresh dashboard data"
        >
          <AiOutlineReload className={sharedStyles.buttonIcon} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </DashboardCard>
  );
});

RefreshCard.displayName = 'RefreshCard';

export default RefreshCard; 