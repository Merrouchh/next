import React, { useState } from 'react';
import styles from '../styles/MediaUploadDialog.module.css';

const MediaUploadDialog = ({ onConfirm, onCancel, file }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(message);
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog}>
        <h3>Upload Media</h3>
        <p>Would you like to add a message with your {file.type.startsWith('image/') ? 'image' : 'video'}?</p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            className={styles.messageInput}
          />
          <div className={styles.buttons}>
            <button 
              type="button" 
              onClick={() => onConfirm(message)}
              className={styles.confirmButton}
            >
              Upload {message.trim() ? 'with message' : 'without message'}
            </button>
            <button 
              type="button" 
              onClick={onCancel}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MediaUploadDialog; 