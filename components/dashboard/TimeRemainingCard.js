import React from 'react';
import { useRouter } from 'next/router';
import { AiOutlineClockCircle } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import { formatTimeRemaining } from '../../utils/dashboardHelpers';
import styles from '../../styles/Dashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';

const TimeRemainingCard = React.memo(({ timeInfo }) => {
  const router = useRouter();

  const hasTime = timeInfo?.total && (timeInfo.total.hours > 0 || timeInfo.total.minutes > 0);
  const formattedTime = hasTime ? formatTimeRemaining(timeInfo.total.hours, timeInfo.total.minutes) : null;

  return (
    <DashboardCard 
      title="Time Remaining"
      icon={<AiOutlineClockCircle size={24} />}
      className={styles.mediumCard}
    >
      <div className={styles.timeInfoContainer}>
        {hasTime && formattedTime ? (
          // Show total time remaining with smart formatting
          <div className={styles.timePackage}>
            <div className={styles.packageLabel}>TIME REMAINING</div>
            <div className={styles.packageTime}>
              <span className={styles.totalTime}>
                {formattedTime}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.noTimeContainer}>
            <p className={styles.noTime}>No Time Remaining!</p>
            <p className={styles.noTimeMessage}>
              Your account needs to be recharged to continue gaming.
            </p>
            <div className={styles.noTimeButtonWrapper}>
              <button 
                className={sharedStyles.primaryButton}
                onClick={() => router.push('/shop')}
              >
                Recharge Now
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardCard>
  );
});

TimeRemainingCard.displayName = 'TimeRemainingCard';

export default TimeRemainingCard; 