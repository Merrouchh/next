import React, { memo } from 'react';
import styles from './UploadProgress.module.css';
import { MdClose, MdCheckCircle, MdError, MdCancel } from 'react-icons/md';
import { createPortal } from 'react-dom';

const UploadProgress = memo(({ 
  progress, 
  isOpen, 
  onClose, 
  status, 
  onCancel,
  onReset,
  title,
  game,
  allowClose 
}) => {
  if (!isOpen) return null;

  const getStatusInfo = () => {
    switch (status) {
      case 'uploading':
        return {
          text: 'Uploading...',
          color: '#2196F3',
          showCancel: true
        };
      case 'success':
        return {
          text: 'Upload Complete!',
          color: '#4CAF50',
          icon: <MdCheckCircle />,
          showClose: true,
          showDone: true
        };
      case 'error':
        return {
          text: 'Upload Failed',
          color: '#f44336',
          icon: <MdError />,
          showClose: true
        };
      case 'cancelled':
        return {
          text: 'Upload Cancelled',
          color: '#757575',
          icon: <MdCancel />,
          showClose: true
        };
      default:
        return {
          text: 'Processing...',
          color: '#FFA000'
        };
    }
  };

  const handleDone = () => {
    onReset();
    onClose();
  };

  const statusInfo = getStatusInfo();

  const modalContent = (
    <div className={styles.modalOverlay} onClick={allowClose ? onClose : undefined}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 title={title || 'Uploading Video'}>
            {title || 'Uploading Video'}
          </h3>
          {allowClose && (
            <button 
              className={styles.closeButton} 
              onClick={onClose}
              aria-label="Close"
            >
              <MdClose />
            </button>
          )}
        </div>

        <div className={styles.content}>
          {game && <p className={styles.game}>{game}</p>}
          
          <div className={styles.progressContainer}>
            <div 
              className={styles.progressBar}
              style={{
                '--progress': `${progress}%`,
                '--status-color': statusInfo.color
              }}
            >
              <div className={styles.progressFill} />
            </div>
            <div className={styles.statusText} style={{ color: statusInfo.color }}>
              {statusInfo.icon && <span className={styles.icon}>{statusInfo.icon}</span>}
              <span>{statusInfo.text}</span>
              {progress > 0 && progress < 100 && (
                <span className={styles.percentage}>{Math.round(progress)}%</span>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            {statusInfo.showCancel && (
              <button 
                className={styles.cancelButton}
                onClick={onCancel}
              >
                Cancel Upload
              </button>
            )}
            {statusInfo.showDone && (
              <button 
                className={styles.doneButton}
                onClick={handleDone}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Use createPortal to render the modal at the root level
  return createPortal(
    modalContent,
    document.body
  );
});

export default UploadProgress; 