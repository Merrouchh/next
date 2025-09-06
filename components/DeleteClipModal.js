import { MdDelete, MdClose } from 'react-icons/md';
import styles from '../styles/DeleteClipModal.module.css';
import cardStyles from '../styles/ClipCard.module.css';
import { useEffect } from 'react';

const DeleteClipModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = "Delete Clip", 
  message = "Are you sure you want to delete this clip?",
  confirmText = "Delete"
}) => {
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

  // Handle conditional rendering based on state
  if (!isOpen) return null;

  return (
    <div className={`${styles.deleteModalOverlay} ${cardStyles.deleteModalOverlay}`}>
      <div className={`${styles.deleteModal} ${cardStyles.deleteModal}`}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <MdClose />
          </button>
        </div>
        <div className={styles.modalContent}>
          <MdDelete className={styles.deleteIcon} />
          <p>{message}</p>
          <p className={styles.warning}>This action cannot be undone.</p>
        </div>
        <div className={styles.modalActions}>
          <button 
            onClick={onClose}
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={styles.deleteButton}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteClipModal; 