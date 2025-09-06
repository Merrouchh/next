import { MdClose } from 'react-icons/md';
import styles from '../../styles/EditProfileModal.module.css';
import { useEffect } from 'react';
import Portal from '../Portal';

/**
 * Modal component for EditProfile sections
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal content
 */
const EditProfileModal = ({ isOpen, onClose, title, children }) => {
  // Close modal on escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);
  
  // Handle conditional rendering based on state
  if (!isOpen) return null;

  return (
    <Portal>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div 
          className={styles.modal} 
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on modal content
        >
          <div className={styles.modalHeader}>
            <h3>{title}</h3>
            <button onClick={onClose} className={styles.closeButton}>
              <MdClose />
            </button>
          </div>
          
          <div className={styles.modalContent}>
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default EditProfileModal; 