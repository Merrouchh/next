import { useState } from 'react';
import { useRouter } from 'next/router'; // Import useRouter for navigation
import { validateUserCredentials } from '../utils/api'; // Import API function
import { useAuth } from "../contexts/AuthContext"; // Import useAuth to get logIn function
import styles from './LoginModal.module.css'; // Add your styles here

const LoginModal = ({ isOpen, onClose }) => {
  // Declare hooks at the start of the component (unconditionally)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const { logIn } = useAuth(); // Get the logIn function from context

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Call the validateUserCredentials function from api.js
      const response = await validateUserCredentials(username, password);

      if (response.isValid) { // Check for isValid instead of result === 0
        const { userId, username: returnedUsername } = response;

        // Save username and userId in localStorage
        localStorage.setItem('username', returnedUsername);
        localStorage.setItem('userId', userId);

        // Update global auth state using logIn function from context
        logIn(returnedUsername, userId); // Call logIn from context

        // Close the modal and redirect
        onClose();
        router.push('/'); // Redirect to the desired page
      } else {
        setErrorMessage('Invalid credentials. Please try again.');
      }
    } catch (error) {
      setErrorMessage('An error occurred. Please try again later.');
    }
  };

  return (
    isOpen && (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
          <h2 className={styles.modalTitle}>Login</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Username"
              className={styles.inputField}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className={styles.inputField}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
            <button type="submit" className={styles.loginButton}>
              Login
            </button>
          </form>
        </div>
      </div>
    )
  );
};

export default LoginModal;
