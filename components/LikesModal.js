import { useRef } from 'react';
import { MdClose, MdPerson } from 'react-icons/md';
import styles from '../styles/LikesModal.module.css';
import Portal from './Portal';

const LikesModal = ({ isOpen, onClose, likes }) => {
  const modalRef = useRef();

  if (!isOpen) return null;

  return (
    <Portal>
      <div 
        className={styles.modalOverlay}
        onClick={onClose}
      >
        <div 
          ref={modalRef} 
          className={styles.modal} 
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h3>Liked by ({likes.length})</h3>
            <button onClick={onClose} className={styles.closeButton}>
              <MdClose />
            </button>
          </div>
          <div className={styles.modalContent}>
            {likes.length === 0 ? (
              <p className={styles.noLikes}>No likes yet</p>
            ) : (
              <ul className={styles.likesList}>
                {likes.map((like) => (
                  <li key={like.id} className={styles.likeItem}>
                    <div className={styles.userAvatar}>
                      <div className={styles.defaultAvatar}>
                        <MdPerson />
                      </div>
                    </div>
                    <span className={styles.username}>
                      {like.userDetails?.username || 'Unknown User'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default LikesModal; 