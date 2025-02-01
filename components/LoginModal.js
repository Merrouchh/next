import { useState } from 'react';
import { validateUserCredentials } from '../utils/api';
import { useAuth } from "../contexts/AuthContext";
import styles from '../styles/LoginModal.module.css';
import { AiOutlineLoading3Quarters, AiOutlineUser, AiOutlineLock, AiOutlineMail } from 'react-icons/ai';
import { motion, AnimatePresence } from 'framer-motion';

const LoginModal = ({ isOpen, onClose }) => {
  const { login, userExists, createUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isValidated, setIsValidated] = useState(false);

  const handleValidation = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    
    const lowerCaseUsername = username.toLowerCase();
    
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const response = await validateUserCredentials(lowerCaseUsername, password);
      
      if (response.isValid) {
        const existingUser = await userExists(lowerCaseUsername);
        
        if (existingUser) {
          const loginSuccess = await login(lowerCaseUsername, password);
          
          if (loginSuccess) {
            console.log('Login successful');
            onClose();
            // Force a re-render of the layout
            window.location.reload();
          } else {
            setErrorMessage('Login failed. Please try again');
          }
        } else {
          setIsValidated(true);
          setIsNewUser(true);
          setErrorMessage('');
        }
      } else {
        setErrorMessage('Invalid credentials. Please try again');
      }
    } catch (error) {
      console.error('Error during validation:', error);
      setErrorMessage('An error occurred. Please try again later');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e?.preventDefault(); // Make it optional for both button click and form submit
    setIsLoading(true);
    setError('');
    
    const lowerCaseUsername = username.toLowerCase();
    
    if (!email.trim()) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      await createUser(email, password, lowerCaseUsername);
      onClose();
    } catch (err) {
      setError('Failed to sign up. Please try again');
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className={styles.modal}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <button 
              className={styles.closeButton} 
              onClick={onClose}
              disabled={isLoading}
            >
              &times;
            </button>
            
            <AnimatePresence mode="wait">
              {!isValidated ? (
                <motion.div
                  key="login"
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 300, opacity: 0 }}
                  transition={{ type: "spring", duration: 0.5 }}
                >
                  <h2 className={styles.modalTitle}>Welcome Back</h2>
                  <form onSubmit={handleValidation}>
                    <div className={styles.inputWrapper}>
                      <AiOutlineUser className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Username"
                        className={styles.inputField}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className={styles.inputWrapper}>
                      <AiOutlineLock className={styles.inputIcon} />
                      <input
                        type="password"
                        placeholder="Password"
                        className={styles.inputField}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    
                    <AnimatePresence>
                      {errorMessage && (
                        <motion.p 
                          className={styles.errorMessage}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          {errorMessage}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button 
                      type="submit" 
                      className={`${styles.loginButton} ${isLoading ? styles.loading : ''}`}
                      disabled={isLoading}
                    >
                      <motion.div
                        className={styles.buttonContent}
                        animate={isLoading ? { scale: 0.95 } : { scale: 1 }}
                      >
                        {isLoading ? (
                          <div className={styles.loadingWrapper}>
                            <AiOutlineLoading3Quarters className={styles.loadingIcon} />
                            <span>Logging in...</span>
                          </div>
                        ) : (
                          'Login'
                        )}
                      </motion.div>
                    </button>
                  </form>
                </motion.div>
              ) : (
                isNewUser && (
                  <motion.div
                    key="signup"
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -300, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.5 }}
                  >
                    <h2 className={styles.modalTitle}>Complete Sign Up</h2>
                    <form onSubmit={handleSignUp}>
                      <div className={styles.inputWrapper}>
                        <AiOutlineMail className={styles.inputIcon} />
                        <input
                          type="email"
                          placeholder="Email"
                          className={styles.inputField}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>

                      <AnimatePresence>
                        {error && (
                          <motion.p 
                            className={styles.errorMessage}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <button 
                        type="submit"
                        className={`${styles.loginButton} ${isLoading ? styles.loading : ''}`}
                        disabled={isLoading}
                      >
                        <motion.div
                          className={styles.buttonContent}
                          animate={isLoading ? { scale: 0.95 } : { scale: 1 }}
                        >
                          {isLoading ? (
                            <div className={styles.loadingWrapper}>
                              <AiOutlineLoading3Quarters className={styles.loadingIcon} />
                              <span>Creating account...</span>
                            </div>
                          ) : (
                            'Complete Sign Up'
                          )}
                        </motion.div>
                      </button>
                    </form>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;