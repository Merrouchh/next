import React from 'react';
import styles from '../styles/UploadProgress.module.css';
import { MdClose, MdCheckCircle, MdError, MdCancel } from 'react-icons/md';

const UploadProgress = ({ progress, isOpen, onClose, status, onCancel, title, game }) => {
  if (!isOpen) return null;

  const getStatusContent = () => {
    switch (status) {
      case 'uploading':
        return (
          <>
            <div className={styles.details}>
              <h3>{title}</h3>
              <p>{game}</p>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={styles.progressText}>{progress}% uploaded</p>
            <button onClick={onCancel} className={styles.cancelButton}>
              Cancel Upload
            </button>
          </>
        );
      case 'success':
        return (
          <div className={styles.statusMessage}>
            <MdCheckCircle className={styles.successIcon} />
            <p>Upload Complete!</p>
          </div>
        );
      case 'error':
        return (
          <div className={styles.statusMessage}>
            <MdError className={styles.errorIcon} />
            <p>Upload Failed. Please try again.</p>
          </div>
        );
      case 'cancelled':
        return (
          <div className={styles.statusMessage}>
            <MdCancel className={styles.cancelIcon} />
            <p>Upload Cancelled</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button 
          className={styles.closeButton} 
          onClick={onClose}
          disabled={status === 'uploading'}
        >
          <MdClose />
        </button>
        <div className={styles.content}>
          {getStatusContent()}
        </div>
      </div>
    </div>
  );
};

export default UploadProgress; 