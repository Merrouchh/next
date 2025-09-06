import { MdClose } from 'react-icons/md';
import styles from '../styles/ExpandedTitleModal.module.css';
import { useEffect } from 'react';

const ExpandedTitleModal = ({ isOpen, onClose, title }) => {
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
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Clip Title</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <MdClose />
          </button>
        </div>
        <div className={styles.modalContent}>
          <p className={styles.title}>{title}</p>
        </div>
      </div>
    </div>
  );
};

export default ExpandedTitleModal; 