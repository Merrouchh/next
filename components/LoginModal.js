import { useState } from 'react';
import { validateUserCredentials } from '../utils/api';
import { useAuth } from "../contexts/AuthContext";
import styles from '../styles/LoginModal.module.css';
import { AiOutlineLoading3Quarters, AiOutlineUser, AiOutlineLock, AiOutlineMail } from 'react-icons/ai';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '../utils/supabase/component';

const LoginModal = ({ isOpen, onClose }) => {
  const { login, userExists, createUser } = useAuth();
  const [step, setStep] = useState('INITIAL'); // INITIAL -> VALIDATE -> CREATE -> LOGIN
  const [formData, setFormData] = useState({
    username: '',
    gizmoPassword: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [validatedGizmoData, setValidatedGizmoData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState({
    email: { isValid: false, message: '' },
    password: { isValid: false, message: '' },
    confirmPassword: { isValid: false, message: '' }
  });

  // Reset function to clear all states
  const resetModal = () => {
    setFormData({
      username: '',
      gizmoPassword: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setValidatedGizmoData(null);
    setError('');
    setStep('INITIAL');
    setIsLoading(false);
  };

  // Handle modal close
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Handle step changes with reset of relevant fields
  const handleStepChange = (newStep) => {
    setError('');
    
    // Reset specific fields based on step
    if (newStep === 'INITIAL') {
      resetModal();
    } else if (newStep === 'LOGIN') {
      setFormData(prev => ({
        ...prev,
        password: '',
        email: ''
      }));
    } else if (newStep === 'VALIDATE') {
      setFormData(prev => ({
        ...prev,
        gizmoPassword: ''
      }));
      setValidatedGizmoData(null);
    }
    
    setStep(newStep);
  };

  // Initial step - Choose login or create account
  const renderInitialStep = () => (
    <div className={styles.stepContainer}>
      <h2>Welcome Back!</h2>
      <p className={styles.subtitle}>
        Login to your account or create a new one
      </p>
      <div className={styles.buttonGroup}>
        <button 
          onClick={() => setStep('LOGIN')}
          className={`${styles.actionButton} ${styles.loginButton}`}
        >
          <AiOutlineUser className={styles.buttonIcon} />
          Login to Account
        </button>
        <div className={styles.divider}>
          <span>or</span>
        </div>
        <button 
          onClick={() => setStep('VALIDATE')}
          className={`${styles.actionButton} ${styles.createButton}`}
        >
          <AiOutlineUser className={styles.buttonIcon} />
          Create New Account
        </button>
      </div>
    </div>
  );

  // Login step
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { success, message } = await login(formData.username, formData.password);
      
      if (success) {
        handleClose(); // Close modal and reset state on success
      } else {
        setError(message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login step render
  const renderLoginStep = () => (
    <div className={styles.stepContainer}>
      <h2>Login</h2>
      <form className={styles.form} onSubmit={handleLogin}>
        <div className={styles.inputWrapper}>
          <AiOutlineUser className={styles.inputIcon} />
          <input
            type="text"
            placeholder="Username or Email"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
          />
        </div>
        <div className={styles.inputWrapper}>
          <AiOutlineLock className={styles.inputIcon} />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
          />
        </div>
        <button type="submit" className={styles.submitButton} disabled={isLoading}>
          {isLoading ? (
            <div className={styles.loadingWrapper}>
              <AiOutlineLoading3Quarters className={styles.loadingIcon} />
              <span>Logging in...</span>
            </div>
          ) : (
            'Login'
          )}
        </button>
        <button 
          type="button" 
          className={styles.backButton}
          onClick={() => handleStepChange('INITIAL')}
        >
          Back
        </button>
      </form>
    </div>
  );

  // Step 1: Validate with Gizmo
  const handleGizmoValidation = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await validateUserCredentials(
        formData.username, 
        formData.gizmoPassword
      );

      console.log('Validation response:', response);

      // Check if response indicates valid credentials
      if (response.isValid && response.userId) {
        const gizmoId = response.userId;
        const supabase = createClient();

        // Check if this gizmo ID already exists in our database
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('username')
          .eq('gizmo_id', gizmoId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingUser) {
          setError(
            <div>
              This gaming account is already linked to an existing account.
              <button onClick={() => setStep('LOGIN')}>
                Go to Login
              </button>
            </div>
          );
          return;
        }

        // Store the validated data
        setValidatedGizmoData({
          ...response,
          gizmoId: gizmoId
        });
        setStep('CREATE');
      } else {
        setError('Invalid gaming account credentials');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setError('Error validating credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Validation step
  const renderValidateStep = () => (
    <div className={styles.stepContainer}>
      <h2>Validate Gaming Account</h2>
      <form className={styles.form} onSubmit={handleGizmoValidation}>
        <div className={styles.inputWrapper}>
          <AiOutlineUser className={styles.inputIcon} />
          <input
            type="text"
            placeholder="Gaming Username"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
          />
        </div>
        <div className={styles.inputWrapper}>
          <AiOutlineLock className={styles.inputIcon} />
          <input
            type="password"
            placeholder="Gaming Password"
            value={formData.gizmoPassword}
            onChange={(e) => setFormData({...formData, gizmoPassword: e.target.value})}
          />
        </div>
        <button type="submit" className={styles.submitButton} disabled={isLoading}>
          {isLoading ? (
            <div className={styles.loadingWrapper}>
              <AiOutlineLoading3Quarters className={styles.loadingIcon} />
              <span>Validating...</span>
            </div>
          ) : (
            'Validate Account'
          )}
        </button>
        <button 
          type="button" 
          className={styles.backButton}
          onClick={() => handleStepChange('INITIAL')}
        >
          Back
        </button>
      </form>
    </div>
  );

  // Update validateEmail function - remove domain suggestions
  const validateEmail = async (email) => {
    if (!email) {
      return { isValid: false, message: '' };
    }

    // Basic format check
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_REGEX.test(email)) {
      return { isValid: false, message: 'Please enter a valid email address' };
    }

    // Check if email exists in database
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (data) {
      return { isValid: false, message: 'Email already exists' };
    }

    return { isValid: true, message: 'Email is available' };
  };

  // Handle email change with validation
  const handleEmailChange = async (e) => {
    const email = e.target.value;
    setFormData(prev => ({ ...prev, email }));
    const emailValidation = await validateEmail(email);
    setValidation(prev => ({ ...prev, email: emailValidation }));
  };

  // Add password validation
  const validatePassword = (password) => {
    if (!password) {
      return { isValid: false, message: '' };
    }
    if (password.length < 6) {
      return { isValid: false, message: 'Password must be at least 6 characters' };
    }
    return { isValid: true, message: 'Password is valid' };
  };

  // Handle password change with validation
  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setFormData(prev => ({ ...prev, password }));
    const passwordValidation = validatePassword(password);
    setValidation(prev => ({ ...prev, password: passwordValidation }));
    
    // Also validate confirm password if it exists
    if (formData.confirmPassword) {
      setValidation(prev => ({
        ...prev,
        confirmPassword: {
          isValid: password === formData.confirmPassword,
          message: password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'
        }
      }));
    }
  };

  // Add confirm password validation and handling
  const handleConfirmPasswordChange = (e) => {
    const confirmPassword = e.target.value;
    setFormData(prev => ({ ...prev, confirmPassword }));
    
    setValidation(prev => ({
      ...prev,
      confirmPassword: {
        isValid: confirmPassword === formData.password,
        message: confirmPassword === formData.password ? 'Passwords match' : 'Passwords do not match'
      }
    }));
  };

  // Update handleCreateAccount to check all validations
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');

    // Check if all validations pass
    if (!validation.email.isValid || 
        !validation.password.isValid || 
        !validation.confirmPassword?.isValid) {
      setError('Please fix the validation errors before continuing');
      return;
    }

    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Rest of your validation checks...
    if (!validatedGizmoData?.gizmoId) {
      setError('Missing gaming account data. Please validate again.');
      return;
    }

    setIsLoading(true);

    try {
      const success = await createUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        gizmoId: validatedGizmoData.gizmoId
      });

      if (success) {
        setStep('SUCCESS');
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Create account error:', error);
      if (error.message?.includes('registered')) {
        setError('This email is already registered. Please use a different email.');
      } else if (error.message?.includes('password')) {
        setError('Password must be at least 6 characters long');
      } else {
        setError('Error creating account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create account step
  const renderCreateStep = () => (
    <div className={styles.stepContainer}>
      <h2>Create Your Account</h2>
      <p className={styles.subtitle}>
        Create an account that will be linked to your gaming account: 
        <span className={styles.highlight}>{formData.username}</span>
      </p>
      <form className={styles.form} onSubmit={handleCreateAccount}>
        <div className={`${styles.inputWrapper} ${
          validation.email.isValid ? styles.valid : 
          validation.email.message ? styles.error : ''
        }`}>
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleEmailChange}
            required
          />
          <AiOutlineMail className={styles.inputIcon} />
          {validation.email.message && (
            <span className={validation.email.isValid ? styles.inputValid : styles.inputError}>
              {validation.email.message}
            </span>
          )}
        </div>
        <div className={`${styles.inputWrapper} ${
          validation.password.isValid ? styles.valid : 
          validation.password.message ? styles.error : ''
        }`}>
          <AiOutlineLock className={styles.inputIcon} />
          <input
            type="password"
            placeholder="New Password"
            value={formData.password}
            onChange={handlePasswordChange}
            required
            minLength={6}
          />
          {validation.password.message && (
            <span className={validation.password.isValid ? styles.inputValid : styles.inputError}>
              {validation.password.message}
            </span>
          )}
        </div>
        <div className={`${styles.inputWrapper} ${
          validation.confirmPassword?.isValid ? styles.valid : 
          validation.confirmPassword?.message ? styles.error : ''
        }`}>
          <AiOutlineLock className={styles.inputIcon} />
          <input
            type="password"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleConfirmPasswordChange}
            required
          />
          {validation.confirmPassword?.message && (
            <span className={validation.confirmPassword.isValid ? styles.inputValid : styles.inputError}>
              {validation.confirmPassword.message}
            </span>
          )}
        </div>
        <button type="submit" className={styles.submitButton} disabled={isLoading}>
          {isLoading ? (
            <div className={styles.loadingWrapper}>
              <AiOutlineLoading3Quarters className={styles.loadingIcon} />
              <span>Creating Account...</span>
            </div>
          ) : (
            'Create Account'
          )}
        </button>
        <button 
          type="button" 
          className={styles.backButton}
          onClick={() => setStep('VALIDATE')}
        >
          Back
        </button>
      </form>
    </div>
  );

  // Success step
  const renderSuccessStep = () => (
    <div className={styles.stepContainer}>
      <h2>Account Created!</h2>
      <p className={styles.successMessage}>
        Your account has been successfully created and linked to your gaming account.
      </p>
      <div className={styles.loadingWrapper}>
        <AiOutlineLoading3Quarters className={styles.loadingIcon} />
        <span>Redirecting to dashboard...</span>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 'INITIAL':
        return renderInitialStep();
      case 'LOGIN':
        return renderLoginStep();
      case 'VALIDATE':
        return renderValidateStep();
      case 'CREATE':
        return renderCreateStep();
      case 'SUCCESS':
        return renderSuccessStep();
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className={styles.modalBackdrop}
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.div 
          className={styles.modal}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
        >
          <button 
            className={styles.closeButton} 
            onClick={handleClose}
            disabled={isLoading}
          >
            &times;
          </button>
          
          {error && <div className={styles.error}>{error}</div>}
          {renderStep()}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoginModal;