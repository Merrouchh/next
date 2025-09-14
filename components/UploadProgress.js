import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/UploadProgress.module.css';
import { MdClose, MdCheckCircle, MdError, MdCancel } from 'react-icons/md';
import { createPortal } from 'react-dom';

const UploadProgress = ({ 
  progress, 
  isOpen, 
  onClose, 
  status, 
  onCancel,
  onReset,
  title,
  game,
  allowClose,
  isNetworkFile = false 
}) => {
  const [mounted, setMounted] = useState(false);
  
  // Make sure we only mount on client-side
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // Create a safe cancel handler that logs everything for debugging
  const handleCancel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[UploadProgress] Cancel button clicked');
    console.log('[UploadProgress] onCancel type:', typeof onCancel);
    
    if (typeof onCancel === 'function') {
      console.log('[UploadProgress] Calling onCancel function');
      onCancel();
    } else {
      console.error('[UploadProgress] onCancel is not a function:', onCancel);
    }
  }, [onCancel]);

  // Handle completion of upload
  const handleDone = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[UploadProgress] Done button clicked');
    if (typeof onReset === 'function') {
      onReset();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onReset, onClose]);

  const getStatusInfo = () => {
    console.log(`[UploadProgress] Getting status info for status: ${status}`);
    
    switch (status) {
      case 'uploading':
        console.log('[UploadProgress] Status is "uploading", should show cancel button');
        return {
          text: 'Uploading...',
          color: '#2196F3',
          showCancel: true
        };
      case 'success':
        console.log('[UploadProgress] Status is "success", auto-closing enabled');
        return {
          text: 'Upload Complete!',
          color: '#4CAF50',
          icon: <MdCheckCircle />,
          showClose: false,
          showDone: false
        };
      case 'error':
        console.log('[UploadProgress] Status is "error", should show close button');
        return {
          text: 'Upload Failed',
          color: '#f44336',
          icon: <MdError />,
          showClose: true
        };
      case 'cancelled':
        console.log('[UploadProgress] Status is "cancelled", should show close button');
        return {
          text: 'Upload Cancelled',
          color: '#757575',
          icon: <MdCancel />,
          showClose: true
        };
      case 'preparing':
        console.log('[UploadProgress] Status is "preparing", should show cancel button');
        return {
          text: 'Preparing...',
          color: '#FFA000',
          showCancel: true
        };
      default:
        console.log(`[UploadProgress] Status is default (${status}), showing processing`);
        return {
          text: 'Processing...',
          color: '#FFA000'
        };
    }
  };

  const statusInfo = getStatusInfo();

  const getStatusMessage = () => {
    if (isNetworkFile) {
      switch (status) {
        case 'preparing':
          return 'Preparing network file for upload...';
        case 'uploading':
          return 'Uploading from network location (this may take longer)...';
        case 'processing':
          return 'Processing your video...';
        case 'error':
          return 'Upload failed. Network files can be problematic.';
        case 'cancelled':
          return 'Upload cancelled.';
        default:
          return 'Upload in progress...';
      }
    }
    
    switch (status) {
      case 'preparing':
        return 'Preparing upload...';
      case 'uploading':
        return 'Uploading your video...';
      case 'processing':
        return 'Processing your video...';
      case 'error':
        return 'Upload failed.';
      case 'cancelled':
        return 'Upload cancelled.';
      default:
        return 'Upload in progress...';
    }
  };

  // Auto-close modal when status becomes 'success'
  useEffect(() => {
    if (status === 'success' && isOpen) {
      console.log('[UploadProgress] Status changed to success, auto-closing after 1.5 seconds');
      const timer = setTimeout(() => {
        console.log('[UploadProgress] Auto-closing from success state');
        if (typeof onReset === 'function') {
          onReset();
        }
        if (typeof onClose === 'function') {
          onClose();
        }
      }, 1000); // Close after 1 second to let user see success state
      
      return () => clearTimeout(timer);
    }
  }, [status, isOpen, onReset, onClose]);
  
  // Additional styles for success message
  const successStyle = status === 'success' ? {
    animation: 'fadeIn 0.3s ease',
    padding: '12px 16px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
    borderRadius: '4px',
    margin: '12px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#4CAF50',
    fontWeight: 'bold'
  } : {};
  
  // Handle conditional rendering based on state
  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className={styles.overlay} onClick={e => e.stopPropagation()}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 
            title={title && title.length > 30 ? title : (title || 'Uploading Video')}
          >
            {title || 'Uploading Video'}
          </h3>
          {allowClose && status !== 'success' && (
            <button 
              className={styles.closeButton} 
              onClick={onClose}
              aria-label="Close"
              type="button"
            >
              <MdClose />
            </button>
          )}
        </div>

        <div className={styles.content}>
          {game && <p className={styles.game}>{game}</p>}
          
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%`, backgroundColor: statusInfo.color }}
            />
          </div>
          
          <div className={styles.progressText} style={{ color: statusInfo.color }}>
            {statusInfo.icon && <span className={styles.icon}>{statusInfo.icon}</span>}
            <span>{statusInfo.text}</span>
            {progress > 0 && progress < 100 && (
              <span className={styles.percentage}>{Math.round(progress)}%</span>
            )}
          </div>

          <p className={styles.statusMessage}>{getStatusMessage()}</p>
          
          {status === 'success' && (
            <div style={successStyle}>
              <MdCheckCircle size={24} />
              <span>Upload completed successfully!</span>
            </div>
          )}

          <div className={styles.actions} style={{ marginTop: '1rem' }}>
            {statusInfo.showCancel && (
              <button 
                className={styles.cancelButton}
                onClick={handleCancel}
                type="button"
              >
                Cancel Upload
              </button>
            )}
            {statusInfo.showDone && (
              <button 
                className={styles.doneButton}
                onClick={handleDone}
                type="button"
              >
                Done
              </button>
            )}
          </div>

          {isNetworkFile && status === 'uploading' && (
            <div className={styles.networkWarning}>
              <p>Uploading from a network location may be slower.</p>
              <p>For faster uploads, consider copying the file to your local drive first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Use createPortal to render the modal at the root level
  return createPortal(modalContent, document.body);
};

export default UploadProgress; 