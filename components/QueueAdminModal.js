import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimes, FaInfoCircle } from 'react-icons/fa';
import styles from '../styles/QueueAdminModal.module.css';

const QueueAdminModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  type = 'info', // 'success', 'error', 'warning', 'info', 'confirm'
  showConfirmButton = false,
  confirmText = 'Yes',
  cancelText = 'No',
  autoClose = false,
  autoCloseDelay = 3000
}) => {
  
  React.useEffect(() => {
    if (autoClose && isOpen && type !== 'confirm') {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [autoClose, isOpen, type, autoCloseDelay, onClose]);

  // Handle conditional rendering based on state
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className={styles.successIcon} />;
      case 'error':
        return <FaExclamationTriangle className={styles.errorIcon} />;
      case 'warning':
        return <FaExclamationTriangle className={styles.warningIcon} />;
      case 'confirm':
        return <FaInfoCircle className={styles.confirmIcon} />;
      default:
        return <FaInfoCircle className={styles.infoIcon} />;
    }
  };

  const getModalClass = () => {
    return `${styles.modal} ${styles[type]}`;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={getModalClass()} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconTitle}>
            {getIcon()}
            <h3 className={styles.title}>{title}</h3>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
        </div>
        
        <div className={styles.actions}>
          {type === 'confirm' || showConfirmButton ? (
            <>
              <button 
                className={`${styles.button} ${styles.cancelButton}`}
                onClick={onClose}
              >
                {cancelText}
              </button>
              <button 
                className={`${styles.button} ${styles.confirmButton}`}
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button 
              className={`${styles.button} ${styles.okButton}`}
              onClick={onClose}
            >
              OK
            </button>
          )}
        </div>
        
        {autoClose && type !== 'confirm' && (
          <div className={styles.autoCloseIndicator}>
            <div className={styles.autoCloseBar}></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueAdminModal; 