import { useState } from 'react';
import { FaDesktop, FaUser, FaSearch, FaTimes } from 'react-icons/fa';
import styles from '../styles/LoginUserModal.module.css';
import Portal from './Portal';
import { loginUserToComputer, fetchGizmoId } from '../utils/api';

/**
 * Modal component for logging users into computers (Admin version)
 * 
 * @param {Object} props Component props
 * @param {boolean} props.isOpen Whether the modal is open
 * @param {Function} props.onClose Function to close the modal
 * @param {Object} props.selectedComputer Selected computer data (hostId, type, number)
 * @param {Function} props.onSuccess Callback when login is successful
 */
const LoginUserModal = ({ isOpen, onClose, selectedComputer, onSuccess }) => {
  // State for input value (username or ID)
  const [userInput, setUserInput] = useState('');
  // State for loading status
  const [isLoading, setIsLoading] = useState(false);
  // State for search results
  const [foundUser, setFoundUser] = useState(null);
  // State for error message
  const [errorMessage, setErrorMessage] = useState('');
  // State for success message
  const [successMessage, setSuccessMessage] = useState('');

  // Close modal and reset state
  const handleClose = () => {
    // Reset state
    setUserInput('');
    setFoundUser(null);
    setErrorMessage('');
    setSuccessMessage('');
    // Close modal
    onClose();
  };

  // Search for user by username
  const handleSearch = async () => {
    // Reset error message
    setErrorMessage('');
    setFoundUser(null);
    setSuccessMessage('');
    
    // Validate input
    if (!userInput.trim()) {
      setErrorMessage('Please enter a username or ID');
      return;
    }

    try {
      setIsLoading(true);
      
      // If input is a number, use it directly as Gizmo ID
      if (/^\d+$/.test(userInput)) {
        setFoundUser({
          gizmoId: parseInt(userInput, 10),
          username: `User ${userInput}` // Fallback display name
        });
        return;
      }
      
      // Otherwise, search by username
      const { gizmoId } = await fetchGizmoId(userInput);
      
      if (gizmoId) {
        setFoundUser({
          gizmoId,
          username: userInput
        });
      } else {
        setErrorMessage('User not found');
      }
    } catch (error) {
      console.error('Error finding user:', error);
      setErrorMessage('Failed to find user');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login user to computer
  const handleLogin = async () => {
    if (!foundUser?.gizmoId || !selectedComputer?.hostId) {
      setErrorMessage('Missing required information');
      return;
    }

    try {
      setIsLoading(true);
      
      const result = await loginUserToComputer(
        foundUser.gizmoId, 
        selectedComputer.hostId
      );
      
      if (result.success) {
        // Reset any existing error messages
        setErrorMessage('');
        
        // Check for specific result codes and provide appropriate messages
        if (result.result === 0) {
          // Successful login (green)
          setSuccessMessage(`Successfully logged in ${foundUser.username} to ${selectedComputer.type} ${selectedComputer.number} (Code: 0)`);
          
          // Call onSuccess callback for successful login
          if (typeof onSuccess === 'function') {
            setTimeout(() => {
              onSuccess(foundUser, selectedComputer);
              handleClose();
            }, 1500);
          }
        } else if (result.result === 256) {
          // User is already logged in (red)
          setErrorMessage(`${foundUser.username} is already logged in to another computer (Code: 256)`);
          setSuccessMessage(''); // Clear any success message
        } else if (result.result === 16384) {
          // Insufficient balance (red)
          setErrorMessage(`${foundUser.username} has insufficient balance to log in (Code: 16384)`);
          setSuccessMessage(''); // Clear any success message
        } else {
          // Other codes - show as info, not success or error
          setSuccessMessage(`Login result for ${foundUser.username}: Code ${result.result}`);
        }
      } else {
        // API call failed
        setErrorMessage(result.error || 'Failed to login user');
        setSuccessMessage(''); // Clear any success message
      }
    } catch (error) {
      console.error('Error logging in user:', error);
      setErrorMessage('An error occurred during login');
      setSuccessMessage(''); // Clear any success message
    } finally {
      setIsLoading(false);
    }
  };

  // Handle conditional rendering based on state
  if (!isOpen) return null;

  return (
    <Portal>
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h3>
              <FaDesktop className={styles.headerIcon} /> 
              Login User to {selectedComputer?.type} {selectedComputer?.number}
            </h3>
            <button onClick={handleClose} className={styles.closeButton}>
              <FaTimes />
            </button>
          </div>
          
          <div className={styles.modalContent}>
            {/* Computer information */}
            <div className={styles.computerInfo}>
              <div className={styles.infoIcon}>
                <FaDesktop />
              </div>
              <div className={styles.infoDetails}>
                <h4>Computer Details</h4>
                <p>Type: <strong>{selectedComputer?.type}</strong></p>
                <p>Number: <strong>{selectedComputer?.number}</strong></p>
                <p>Host ID: <strong>{selectedComputer?.hostId}</strong></p>
              </div>
            </div>
            
            {/* User search */}
            <div className={styles.searchSection}>
              <h4>Find User</h4>
              <div className={styles.searchInput}>
                <FaUser className={styles.inputIcon} />
                <input
                  type="text"
                  placeholder="Enter username or ID"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={isLoading}
                />
                <button 
                  onClick={handleSearch} 
                  className={styles.searchButton}
                  disabled={isLoading || !userInput.trim()}
                >
                  <FaSearch />
                </button>
              </div>
              
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
              
              {/* Found user */}
              {foundUser && (
                <div className={styles.foundUserSection}>
                  <div className={styles.foundUser}>
                    <FaUser className={styles.userIcon} />
                    <div className={styles.userDetails}>
                      <h4>{foundUser.username}</h4>
                      <p>Gizmo ID: {foundUser.gizmoId}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleLogin} 
                    className={styles.loginButton}
                    disabled={isLoading || successMessage}
                  >
                    {isLoading ? 'Processing...' : 'Login to Computer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default LoginUserModal; 