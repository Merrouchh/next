import React from 'react';
import styles from '../styles/Modal.module.css'; // Ensure you have the modal styles

const AccountPromptModal = ({ onClose, onLogin }) => {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Account Required</h2>
        <p>You need to create an account in the Merrouch Gaming Center to use this feature.</p>
        <p>If you already have an account, click on "Login" to proceed.</p>
        <div className={styles.buttonContainer}>
          <button onClick={onLogin} className={styles.loginButton}>Login</button>
          <button onClick={onClose} className={styles.closeButton}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default AccountPromptModal; 