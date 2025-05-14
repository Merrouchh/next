import React from 'react';
import styles from '../styles/CancelRegistrationModal.module.css';

export default function CancelRegistrationModal({ onClose, onConfirm, eventTitle }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Cancel Registration</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.warningIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          
          <p className={styles.confirmText}>
            Are you sure you want to cancel your registration for <strong>{eventTitle}</strong>?
          </p>
          
          <p className={styles.warningText}>
            This action cannot be undone and your spot will become available to other players.
          </p>
        </div>
        
        <div className={styles.modalActions}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
          >
            Keep Registration
          </button>
          
          <button
            className={styles.confirmButton}
            onClick={onConfirm}
          >
            Yes, Cancel Registration
          </button>
        </div>
      </div>
    </div>
  );
} 