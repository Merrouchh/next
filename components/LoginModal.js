import { useState } from 'react';
import { useRouter } from 'next/router'; // Import useRouter for navigation
import { validateUserCredentials } from '../utils/api'; // Import API function
import { useAuth } from "../contexts/AuthContext"; // Import useAuth to get login function
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
  const { login, userExists, createUser } = useAuth(); // Get the login, userExists, and createUser functions from context

  const handleValidation = async (e) => {
    e.preventDefault();
    const lowerCaseUsername = username.toLowerCase();
    
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    try {
      // Step 1: Validate credentials with API
      const response = await validateUserCredentials(lowerCaseUsername, password);
      
      if (response.isValid) {
        // Step 2: Check if user exists in Supabase
        const existingUser = await userExists(lowerCaseUsername);
        
        if (existingUser) {
          // Step 3: If exists, login with existing credentials
          console.log('User exists, attempting login with:', lowerCaseUsername);
          const loginSuccess = await login(lowerCaseUsername, password);
          
          if (loginSuccess) {
            onClose();
            router.push('/dashboard');
          } else {
            setErrorMessage('Login failed. Please try again.');
          }
        } else {
          // Step 4: If doesn't exist, show email signup form
          setIsValidated(true);
          setIsNewUser(true);
          setErrorMessage('');
        }
      } else {
        setErrorMessage('Invalid credentials. Please try again.');
      }
    } catch (error) {
      console.error('Error during validation:', error);
      setErrorMessage('An error occurred. Please try again later.');
    }
  };

  const handleSignUp = async () => {
    const lowerCaseUsername = username.toLowerCase();
    
    if (!email) {
      setError('Email is required');
      return;
    }

    try {
      // Step 5: Create new user and login automatically
      await createUser(email, password, lowerCaseUsername);
      onClose();
      router.push('/dashboard');
    } catch (err) {
      setError('Failed to sign up. Please try again.');
      console.error('Signup error:', err);
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
                  Login
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
