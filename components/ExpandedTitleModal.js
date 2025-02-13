import { MdClose } from 'react-icons/md';
import styles from '../styles/ExpandedTitleModal.module.css';

const ExpandedTitleModal = ({ isOpen, onClose, title }) => {
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