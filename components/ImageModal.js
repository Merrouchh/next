import React from 'react';
import styles from '../styles/ImageModal.module.css';

const ImageModal = ({ imageUrl, onClose }) => {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick}>
      <div className={styles.modalContent}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        <img 
          src={imageUrl} 
          alt="Enlarged view" 
          className={styles.modalImage}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};

export default ImageModal; 