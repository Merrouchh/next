import { useRef, useEffect } from 'react';
import { MdClose, MdPerson } from 'react-icons/md';
import styles from '../styles/LikesModal.module.css';
import Portal from './Portal';
import Link from 'next/link';

const LikesModal = ({ isOpen, onClose, likes, _triggerRect, isLoadingLikes }) => {
  const modalRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className={styles.modalOverlay}>
        <div 
          ref={modalRef} 
          className={`${styles.modal} ${isOpen ? styles.open : ''}`}
        >
          <div className={styles.modalHeader}>
            <h3>Liked by ({likes?.length || 0})</h3>
            <button onClick={onClose} className={styles.closeButton}>
              <MdClose />
            </button>
          </div>
          <div className={styles.modalContent}>
            {isLoadingLikes ? (
              <div className={styles.loading}>Loading likes...</div>
            ) : !likes?.length ? (
              <p className={styles.noLikes}>No likes yet</p>
            ) : (
              <ul className={styles.likesList}>
                {likes.map((like) => (
                  <li key={like.id} className={styles.likeItem}>
                    <div className={styles.userAvatar}>
                      <MdPerson />
                    </div>
                    <Link 
                      href={`/profile/${like.username}`}
                      className={styles.username}
                    >
                      {like.username || 'Unknown User'}
                    </Link>
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