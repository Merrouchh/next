import React from 'react';
import { useRouter } from 'next/router';
import { AiOutlineClockCircle } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import styles from '../../styles/Dashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';

const TimeRemainingCard = React.memo(({ timeInfo }) => {
  const router = useRouter();

  const hasTime = timeInfo && Object.values(timeInfo).some(time => time?.hours > 0 || time?.minutes > 0);

  return (
    <DashboardCard 
      title="Time Remaining"
      icon={<AiOutlineClockCircle size={24} />}
      className={styles.mediumCard}
    >
      <div className={styles.timeInfoContainer}>
        {hasTime ? (
          // Show time info if user has any time
          Object.entries(timeInfo).map(([type, time]) => {
            if (time?.hours > 0 || time?.minutes > 0) {
              return (
                <div key={type} className={styles.timePackage}>
                  <div className={styles.packageLabel}>{type.toUpperCase()}</div>
                  <div className={styles.packageTime}>
                    <span className={styles[`${type}Time`]}>
                      {time.hours}h {time.minutes}m
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })
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