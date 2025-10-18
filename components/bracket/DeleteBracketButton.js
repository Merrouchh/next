import React, { useState } from 'react';
import styles from '../../styles/DeleteBracketButton.module.css';
import DeleteBracketModal from '../DeleteBracketModal';

const DeleteBracketButton = ({ 
  onDelete, 
  eventTitle, 
  disabled = false,
  variant = 'default' // 'default' or 'admin'
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = () => {
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowModal(false);
    } catch (error) {
      console.error('Error deleting bracket:', error);
      throw error; // Let the modal handle the error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
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

      <DeleteBracketModal
        isOpen={showModal}
        onClose={handleCancel}
        onConfirm={handleConfirmDelete}
        eventTitle={eventTitle}
        loading={isDeleting}
      />
    </>
  );
};

export default DeleteBracketButton;
