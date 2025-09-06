import { useState, useEffect } from 'react';
import { MdClose, MdContentCopy, MdShare } from 'react-icons/md';
import styles from '../styles/ShareModal.module.css';

const ShareModal = ({ isOpen, onClose, clipId }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  
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

  const clipUrl = `${window.location.origin}/clip/${clipId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(clipUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this clip!',
          url: clipUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    }
  };

  return (
    <div className={styles.shareModalOverlay}>
      <div className={styles.shareModal}>
        <div className={styles.modalHeader}>
          <h3>Share Clip</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <MdClose />
          </button>
        </div>
        
        <div className={styles.modalContent}>
          <div className={styles.options}>
            <button 
              className={styles.optionButton}
              onClick={handleCopyLink}
            >
              <MdContentCopy className={styles.icon} />
              <div className={styles.optionText}>
                <h4>{copySuccess ? 'Copied!' : 'Copy Link'}</h4>
                <p>Copy clip URL to clipboard</p>
              </div>
            </button>

            {navigator.share && (
              <button 
                className={styles.optionButton}
                onClick={handleShare}
              >
                <MdShare className={styles.icon} />
                <div className={styles.optionText}>
                  <h4>Share</h4>
                  <p>Share via your device</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal; 