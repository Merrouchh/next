import React from 'react';
import styles from '../styles/MaintenanceOverlay.module.css';

const MaintenanceOverlay = ({ message = "We're currently performing maintenance. Please check back soon!", fullPage = true }) => {
  return (
    <div className={fullPage ? styles.fullPageOverlay : styles.buttonOverlay}>
      <div className={fullPage ? styles.maintenanceContent : styles.maintenanceIndicator}>
        {fullPage ? (
          <>
            <div className={styles.iconContainer}>
              <svg className={styles.maintenanceIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </div>
            <h2 className={styles.maintenanceTitle}>Maintenance in Progress</h2>
            <p className={styles.maintenanceMessage}>{message}</p>
          </>
        ) : (
          <>
            <svg className={styles.smallIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            <span>{message}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default MaintenanceOverlay; 