import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import styles from '../../styles/DeleteBracketButton.module.css';

const DeleteBracketButton = ({ 
  onDelete, 
  eventTitle, 
  disabled = false,
  variant = 'default' // 'default' or 'admin'
}) => {
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = () => {
    setShowModal(true);
    setConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (confirmText.trim().toLowerCase() !== eventTitle.trim().toLowerCase()) {
      alert(`Please type exactly: "${eventTitle}" (case-insensitive)`);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
      setShowModal(false);
    } catch (error) {
      console.error('Error deleting bracket:', error);
      alert('Failed to delete bracket. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setConfirmText('');
  };

  return (
    <>
      <button 
        className={`${styles.deleteButton} ${styles[variant]}`}
        onClick={handleDeleteClick}
        disabled={disabled || isDeleting}
        title="Delete bracket"
      >
        {isDeleting ? '...' : 'Delete'}
      </button>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Delete Bracket</h3>
              <button 
                className={styles.closeButton}
                onClick={handleCancel}
                disabled={isDeleting}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <p>Type <strong>&ldquo;{eventTitle}&rdquo;</strong> to delete:</p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`Type: &ldquo;${eventTitle}&rdquo;`}
                disabled={isDeleting}
                className={styles.confirmInput}
                autoFocus
              />
            </div>
            
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={handleCancel}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={handleConfirmDelete}
                disabled={isDeleting || confirmText.trim().toLowerCase() !== eventTitle.trim().toLowerCase()}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeleteBracketButton;
