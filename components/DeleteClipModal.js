import { MdDelete, MdClose } from 'react-icons/md';
import styles from '../styles/DeleteClipModal.module.css';
import cardStyles from '../styles/ClipCard.module.css';

const DeleteClipModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className={`${styles.deleteModalOverlay} ${cardStyles.deleteModalOverlay}`}>
      <div className={`${styles.deleteModal} ${cardStyles.deleteModal}`}>
        <div className={styles.modalHeader}>
          <h3>Delete Clip</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <MdClose />
          </button>
        </div>
        <div className={styles.modalContent}>
          <MdDelete className={styles.deleteIcon} />
          <p>Are you sure you want to delete this clip?</p>
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteClipModal; 