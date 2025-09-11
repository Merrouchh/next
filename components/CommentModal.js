import { useState, useEffect, useCallback } from 'react';
import { MdClose } from 'react-icons/md';
import CommentsSection from './CommentsSection';
import Portal from './Portal';
import styles from '../styles/CommentModal.module.css';

/**
 * Modal component for displaying comments
 * 
 * @param {Object} props Component props
 * @param {boolean} props.isOpen Whether the modal is open
 * @param {Function} props.onClose Function to close the modal
 * @param {number} props.clipId The ID of the clip to show comments for
 * @param {string} props.clipTitle The title of the clip
 */
const CommentModal = ({ isOpen, onClose, clipId, clipTitle }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Handle closing with animation
  const handleClose = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      onClose();
    }, 300); // Match animation duration
  }, [onClose]);
  
  // Add escape key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent scrolling of background content
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      // Restore scrolling when modal closes
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);
  
  // Handle conditional rendering based on state
  if (!isOpen && !isAnimating) return null;
  
  return (
    <Portal>
      <div className={`${styles.modalOverlay} ${isAnimating ? styles.closing : ''}`} onClick={handleClose}>
        <div 
          className={`${styles.modalContent} ${isAnimating ? styles.closing : ''}`}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
        >
          <div className={styles.modalHeader}>
            <h2>{clipTitle || 'Clip Comments'}</h2>
            <button 
              className={styles.closeButton}
              onClick={handleClose}
              aria-label="Close modal"
            >
              <MdClose />
            </button>
          </div>
          
          <div className={styles.commentsContainer}>
            <CommentsSection
              clipId={clipId}
              isCollapsible={false}
              initiallyExpanded={true}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default CommentModal; 