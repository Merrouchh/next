import React, { useState } from 'react';
import styles from '../styles/DeleteBracketModal.module.css';

const DeleteBracketModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  eventTitle,
  loading = false
}) => {
  const [confirmText, setConfirmText] = useState('');

  // Reset confirmation text when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setConfirmText('');
    }
  }, [isOpen]);

  const handleConfirmDelete = async () => {
    // Check if confirmation text matches event title or DELETE
    const expectedText = eventTitle && eventTitle.trim() ? eventTitle.trim().toLowerCase() : 'delete';
    if (confirmText.trim().toLowerCase() !== expectedText) {
      return false; // Let parent handle the error message
    }

    try {
      await onConfirm();
      setConfirmText('');
      return true;
    } catch {
      return false;
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onClose();
  };

  const expectedText = eventTitle && eventTitle.trim() ? eventTitle.trim().toLowerCase() : 'delete';
  const isTextValid = confirmText.trim().toLowerCase() === expectedText;

  // Handle conditional rendering based on state
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Delete Tournament Bracket</h3>
          <button 
            className={styles.closeButton}
            onClick={handleCancel}
            disabled={loading}
          >
            ×
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {eventTitle && eventTitle.trim() ? (
            <>
              <p>Type <strong className={styles.selectableText}>&ldquo;{eventTitle}&rdquo;</strong> to delete the tournament bracket:</p>
              <p className={styles.hintText}>💡 You can select and copy the tournament name above</p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`Type: "${eventTitle}"`}
                disabled={loading}
                className={styles.confirmInput}
                autoFocus
              />
            </>
          ) : (
            <>
              <p>Are you sure you want to delete this tournament bracket?</p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type 'DELETE' to confirm"
                disabled={loading}
                className={styles.confirmInput}
                autoFocus
              />
            </>
          )}
          <p className={styles.warning}>
            ⚠️ This action cannot be undone and all match results will be lost.
          </p>
        </div>
        
        <div className={styles.modalActions}>
          <button 
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className={styles.confirmButton}
            onClick={handleConfirmDelete}
            disabled={loading || !isTextValid}
          >
            {loading ? 'Deleting...' : 'Delete Bracket'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteBracketModal;
