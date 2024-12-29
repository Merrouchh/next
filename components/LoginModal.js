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
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isValidated, setIsValidated] = useState(false); // Track if credentials are validated
  const [isNewUser, setIsNewUser] = useState(false); // Track if the user is new
  const router = useRouter();
  const { logIn, userExists, createUser } = useAuth(); // Get the logIn, userExists, and createUser functions from context

  const handleValidation = async (e) => {
    e.preventDefault();
    const lowerCaseUsername = username.toLowerCase();
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    try {
      const response = await validateUserCredentials(lowerCaseUsername, password);
      if (response.isValid) {
        const user = await userExists(lowerCaseUsername);
        if (user) {
          await logIn(lowerCaseUsername, password);
          onClose();
          router.push('/');
        } else {
          setIsValidated(true); // Mark as validated
          setIsNewUser(true); // Mark as new user
          setErrorMessage('');
        }
      } else {
        setErrorMessage('Invalid credentials. Please try again.');
      }
    } catch (error) {
      setErrorMessage('An error occurred. Please try again later.');
    }
  };

  const handleSignUp = async () => {
    const lowerCaseUsername = username.toLowerCase();
    if (email === '') {
      setError('Email is required');
      return;
    }
    try {
      await createUser(email, password, lowerCaseUsername);
      setError('');
      onClose();
      router.push('/'); // Redirect to the desired page
    } catch (err) {
      setError('Failed to sign up');
      console.error(err);
    }
  };

  return (
    isOpen && (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
          {!isValidated ? (
            <>
              <h2 className={styles.modalTitle}>Login</h2>
              <form onSubmit={handleValidation}>
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
                  Validate
                </button>
              </form>
            </>
          ) : (
            isNewUser && (
              <>
                <h2 className={styles.modalTitle}>Sign Up</h2>
                <input
                  type="email"
                  placeholder="Email"
                  className={styles.inputField}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button onClick={handleSignUp} className={styles.loginButton}>
                  Sign Up
                </button>
                {error && <p className={styles.errorMessage}>{error}</p>}
              </>
            )
          )}
        </div>
      </div>
    )
  );
};

export default LoginModal;
