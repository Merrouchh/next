import { MdClose, MdPerson } from 'react-icons/md';
import styles from '../styles/LikesModal.module.css';
import { useRef, useState, useEffect } from 'react';

const LikesModal = ({ isOpen, onClose, likes, isLoadingLikes }) => {
  const modalRef = useRef(null);
  const [hasScroll, setHasScroll] = useState(false);
  const [screenPosition, setScreenPosition] = useState({ nearTop: false, nearBottom: false });

  // Check if modal has scroll
  useEffect(() => {
    if (modalRef.current) {
      const modal = modalRef.current;
      setHasScroll(modal.scrollHeight > modal.clientHeight);
    }
  }, [likes]);

  if (!isOpen) return null;

  return (
    <div 
      ref={modalRef} 
      className={styles.likesModal}
    >
      <div className={styles.modalHeader}>
        <h3>Likes</h3>
        <button onClick={onClose} className={styles.closeButton}>
          <MdClose />
        </button>
      </div>
      
      {isLoadingLikes ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
        </div>
      ) : likes?.length > 0 ? (
        <div className={styles.likesList}>
          {likes.map((like, index) => {
            // Generate a unique key even if user_id is undefined
            const uniqueKey = like.user_id 
              ? `${like.user_id}-${like.created_at || Date.now()}`
              : `like-${index}-${Date.now()}`;

            return (
              <div 
                key={uniqueKey}
                className={styles.likeItem}
              >
                <MdPerson className={styles.userIcon} />
                <span className={styles.username}>{like.username || 'Anonymous'}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          No likes yet
        </div>
      )}
    </div>
  );
};

export default LikesModal; 