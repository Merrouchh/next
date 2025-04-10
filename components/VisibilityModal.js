import { MdClose, MdPublic, MdLock } from 'react-icons/md';
import styles from '../styles/VisibilityModal.module.css';
import { useEffect } from 'react';

const VisibilityModal = ({ isOpen, onClose, isPublic, onConfirm, isUpdating }) => {
  // Close modal on scroll
  useEffect(() => {
    if (!isOpen) return;
    
    const handleScroll = () => {
      onClose();
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;

  return (
    <div className={styles.visibilityModalOverlay}>
      <div className={styles.visibilityModal}>
        <div className={styles.modalHeader}>
          <h3>Change Visibility</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <MdClose />
          </button>
        </div>
        
        <div className={styles.modalContent}>
          <div className={styles.options}>
            <button 
              className={`${styles.optionButton} ${isPublic ? styles.selected : ''}`}
              onClick={() => onConfirm('public')}
              disabled={isUpdating || isPublic}
            >
              <MdPublic className={styles.icon} />
              <div className={styles.optionText}>
                <h4>Public</h4>
                <p>Anyone can view this clip</p>
              </div>
            </button>

            <button 
              className={`${styles.optionButton} ${!isPublic ? styles.selected : ''}`}
              onClick={() => onConfirm('private')}
              disabled={isUpdating || !isPublic}
            >
              <MdLock className={styles.icon} />
              <div className={styles.optionText}>
                <h4>Private</h4>
                <p>Only you can view this clip</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisibilityModal; 