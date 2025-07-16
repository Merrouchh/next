import React from 'react';
import styles from '../../styles/Dashboard.module.css';

const DashboardCard = React.memo(({ 
  title, 
  icon, 
  className = '', 
  onClick, 
  children, 
  isClickable = false 
}) => {
  const cardClasses = `${styles.statCard} ${className} ${isClickable ? styles.clickableCard : ''}`;
  
  return (
    <div 
      className={cardClasses}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      aria-label={isClickable ? `Navigate to ${title}` : undefined}
    >
      <div className={styles.statHeader}>
        <div className={styles.statIcon}>
          {icon}
        </div>
        <h3 className={styles.statTitle}>{title}</h3>
      </div>
      {children}
    </div>
  );
});

DashboardCard.displayName = 'DashboardCard';

export default DashboardCard; 