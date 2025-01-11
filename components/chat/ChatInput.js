import { useState } from 'react';
import styles from '../../styles/Chat.module.css';
import { AiOutlineSend, AiOutlinePaperClip } from 'react-icons/ai';

const ChatInput = ({ 
  newMessage, 
  setNewMessage, 
  selectedFile,
  thumbnail,
  handleFileUpload,
  handleRemoveFile,
  handleSendMessage,
  isUploading,
  MAX_MESSAGE_LENGTH 
}) => {
  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          maxLength={MAX_MESSAGE_LENGTH}
          className={styles.input}
        />
        
        <div className={styles.buttonContainer}>
          <label className={styles.uploadButton}>
            <input
              type="file"
              onChange={handleFileUpload}
              accept="image/*,video/*"
              style={{ display: 'none' }}
            />
            <AiOutlinePaperClip className={styles.uploadIcon} />
          </label>

          <button
            className={styles.sendButton}
            onClick={handleSendMessage}
            disabled={!newMessage.trim() && !selectedFile}
          >
            <AiOutlineSend className={styles.sendIcon} />
          </button>
        </div>
      </div>

      {selectedFile && (
        <div className={styles.selectedFile}>
          {thumbnail && (
            <div className={styles.thumbnailContainer}>
              <img src={thumbnail} alt="Preview" className={styles.thumbnail} />
            </div>
          )}
          <span>{selectedFile.name}</span>
          <button onClick={handleRemoveFile} className={styles.removeFileButton}>
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatInput;
