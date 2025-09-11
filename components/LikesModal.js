import { MdClose, MdPerson } from 'react-icons/md';
import styles from '../styles/LikesModal.module.css';
import cardStyles from '../styles/ClipCard.module.css';
import { useRef, useState, useEffect } from 'react';

const LikesModal = ({ isOpen, onClose, likes, isLoadingLikes }) => {
  const modalRef = useRef(null);
  const [, setHasScroll] = useState(false);
  // const [, setScreenPosition] = useState({ nearTop: false, nearBottom: false }); // Removed unused variable

  // Check if modal has scroll
  useEffect(() => {
    if (modalRef.current) {
      const modal = modalRef.current;
      setHasScroll(modal.scrollHeight > modal.clientHeight);
    }
  }, [likes]);

  // Handle conditional rendering based on state
  if (!isOpen) return null;

  return (
    <div className={`${styles.likesModalOverlay} ${cardStyles.deleteModalOverlay}`}>
      <div 
        ref={modalRef} 
        className={`${styles.likesModal} ${cardStyles.deleteModal}`}
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
              // Generate a unique key, preferring userId but falling back to a stable key
              const uniqueKey = like.userId || like.user_id 
                ? `${like.userId || like.user_id}-${like.createdAt || like.created_at || index}`
                : `like-${index}`;

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
    </div>
  );
};

export default LikesModal; 