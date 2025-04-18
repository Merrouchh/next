import { useState, useEffect } from 'react';
import { FaDesktop, FaTimes } from 'react-icons/fa';
import styles from '../styles/UserLoginModal.module.css';
import Portal from './Portal';
import { loginUserToComputer } from '../utils/api';

/**
 * Simple confirmation modal for users to log in to computers
 * 
 * @param {Object} props Component props
 * @param {boolean} props.isOpen Whether the modal is open
 * @param {Function} props.onClose Function to close the modal
 * @param {Object} props.selectedComputer Selected computer data (hostId, type, number)
 * @param {Function} props.onSuccess Callback when login is successful
 * @param {Object} props.autoLoginUser User data to login (gizmoId, username)
 */
const UserLoginModal = ({ isOpen, onClose, selectedComputer, onSuccess, autoLoginUser }) => {
  // State for loading status
  const [isLoading, setIsLoading] = useState(false);
  // State for error message
  const [errorMessage, setErrorMessage] = useState('');
  // State for success message
  const [successMessage, setSuccessMessage] = useState('');

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessMessage('');
      setIsLoading(false);
    }
  }, [isOpen]);

  // Close modal and reset state
  const handleClose = () => {
    // Reset state
    setErrorMessage('');
    setSuccessMessage('');
    // Close modal
    onClose();
  };

  // Handle login confirmation (Yes button click)
  const handleLoginConfirm = async () => {
    if (!autoLoginUser?.gizmoId || !selectedComputer?.hostId) {
      setErrorMessage('Missing required information');
      return;
    }

    try {
      setIsLoading(true);
      
      const result = await loginUserToComputer(
        autoLoginUser.gizmoId, 
        selectedComputer.hostId
      );
      
      if (result.success) {
        // Check for specific result codes and provide appropriate messages
        if (result.result === 0) {
          // Successful login
          setSuccessMessage(`Successfully logged in to ${selectedComputer.type} PC ${selectedComputer.number}`);
          
          // Call onSuccess callback 
          if (typeof onSuccess === 'function') {
            setTimeout(() => {
              onSuccess(
                { 
                  gizmoId: autoLoginUser.gizmoId, 
                  username: autoLoginUser.username 
                }, 
                selectedComputer
              );
              handleClose();
            }, 1500);
          }
        } else if (result.result === 256) {
          // User is already logged in
          setErrorMessage(`You are already logged in to another computer`);
        } else if (result.result === 16384) {
          // Insufficient balance
          setErrorMessage(`You have insufficient balance to log in`);
        } else {
          // Other codes
          setErrorMessage(`Login failed (Code: ${result.result})`);
        }
      } else {
        // API call failed
        setErrorMessage(result.error || 'Failed to login');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setErrorMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <Portal>
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h3>
              <FaDesktop className={styles.headerIcon} /> 
              Login Confirmation
            </h3>
            <button onClick={handleClose} className={styles.closeButton}>
              <FaTimes />
            </button>
          </div>
          
          <div className={styles.modalContent}>
            {/* Confirmation message */}
            {!successMessage && !errorMessage && (
              <p className={styles.confirmationText}>
                Are you sure you want to login to {selectedComputer?.type} PC {selectedComputer?.number}?
              </p>
            )}
            
            {/* Error message */}
            {errorMessage && (
              <div className={styles.errorMessage}>
                {errorMessage}
              </div>
            )}
            
            {/* Success message */}
            {successMessage && (
              <div className={styles.successMessage}>
                {successMessage}
              </div>
            )}
            
            {/* Buttons */}
            <div className={styles.actionButtons}>
              {!successMessage && (
                <>
                  <button 
                    onClick={handleClose} 
                    className={styles.cancelButton}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  
                  <button 
                    onClick={handleLoginConfirm} 
                    className={styles.confirmButton}
                    disabled={isLoading || successMessage || errorMessage}
                  >
                    {isLoading ? 'Logging in...' : 'Yes, Login'}
                  </button>
                </>
              )}
              
              {(successMessage || errorMessage) && (
                <button 
                  onClick={handleClose} 
                  className={styles.closeModalButton}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default UserLoginModal; 