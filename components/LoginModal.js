import { useState } from 'react';
import { validateUserCredentials } from '../utils/api';
import { useAuth } from "../contexts/AuthContext";
import styles from '../styles/LoginModal.module.css';
import { AiOutlineLoading3Quarters, AiOutlineUser, AiOutlineLock, AiOutlineMail, AiOutlineTrophy, AiOutlineCheckCircle } from 'react-icons/ai';
import { createClient } from '../utils/supabase/component';
import React from 'react';
import { toast } from 'react-hot-toast';
import PasswordResetModal from './PasswordResetModal';

const LoginModal = ({ isOpen, onClose }) => {
  const { login, userExists, createUser } = useAuth();
  const [step, setStep] = useState('LOGIN'); // Always start with the login form
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
  const [showPasswordReset, setShowPasswordReset] = useState(false);

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
    setStep('LOGIN');
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
    if (newStep === 'LOGIN') {
      setFormData(prev => ({
        ...prev,
        username: '',
        password: '',
        email: '',
        confirmPassword: ''
      }));
      // Reset validations
      setValidation({
        email: { isValid: false, message: '' },
        password: { isValid: false, message: '' },
        confirmPassword: { isValid: false, message: '' }
      });
    } else if (newStep === 'VALIDATE') {
      setFormData(prev => ({
        ...prev,
        username: '',
        gizmoPassword: ''
      }));
      setValidatedGizmoData(null);
    } else if (newStep === 'CREATE') {
      setFormData(prev => ({
        ...prev,
        email: '',
        password: '',
        confirmPassword: ''
      }));
      setValidation({
        email: { isValid: false, message: '' },
        password: { isValid: false, message: '' },
        confirmPassword: { isValid: false, message: '' }
      });
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
          onClick={() => handleStepChange('LOGIN')}
          className={`${styles.actionButton} ${styles.loginButton}`}
        >
          <AiOutlineUser className={styles.buttonIcon} />
          Login into website
        </button>
        <div className={styles.divider}>
          <span>or</span>
        </div>
        <button 
          onClick={() => handleStepChange('VALIDATE')}
          className={`${styles.actionButton} ${styles.createButton}`}
        >
          <AiOutlineUser className={styles.buttonIcon} />
          Link Merrouch Account
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
      // Trim the username before login
      const trimmedUsername = formData.username.trim();
      const { success, message } = await login(trimmedUsername, formData.password);
      
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
            onChange={(e) => {
              const value = e.target.value;
              // Only convert to lowercase if it's not an email
              const processedValue = value.includes('@') ? value : value.toLowerCase();
              setFormData({...formData, username: processedValue});
            }}
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
        
        <div className={styles.forgotPasswordContainer}>
          <button 
            type="button" 
            className={styles.forgotPasswordButton}
            onClick={() => setShowPasswordReset(true)}
          >
            Forgot Password?
          </button>
        </div>
        
        <div className={styles.divider}>
          <span>or</span>
        </div>
        
        <button 
          type="button" 
          className={`${styles.actionButton} ${styles.createButton}`}
          onClick={() => handleStepChange('VALIDATE')}
        >
          <AiOutlineUser className={styles.buttonIcon} />
          Link Merrouch Account
        </button>
      </form>
    </div>
  );

  // Handle Gizmo validation
  const handleGizmoValidation = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Trim the username before validation
      const trimmedUsername = formData.username.trim().toLowerCase();
      
      // Add timeout handling for browsers with privacy features
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 15000);
      
      let response;
      try {
        response = await validateUserCredentials(
          trimmedUsername, 
          formData.gizmoPassword
        );
        clearTimeout(timeoutId);
      } catch (vErr) {
        clearTimeout(timeoutId);
        console.error('validateUserCredentials threw:', vErr);
        // Provide more specific error for privacy browsers
        if (vErr.message?.includes('abort') || vErr.message?.includes('timeout')) {
          setError('Your browser may be blocking this request. Try disabling tracking prevention or switch to a different browser.');
        } else {
          setError('Error validating credentials. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      console.log('Validation response:', response);

      // Check if response indicates a connection/privacy error
      if (response.isConnectionError) {
        setError('Connection error: Your browser privacy settings may be blocking this request. Try disabling tracking prevention or try a different browser.');
        setIsLoading(false);
        return;
      }

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
              <button onClick={() => {
                setError('');
                handleStepChange('LOGIN');
              }}>
                Go to Login
              </button>
            </div>
          );
          return;
        }

        // Store the validated data and update formData with trimmed username
        setValidatedGizmoData({
          ...response,
          gizmoId: gizmoId
        });
        
        // Update the formData with the trimmed username
        setFormData({
          ...formData,
          username: trimmedUsername
        });
        
        handleStepChange('CREATE');
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
      <h2>Link Merrouch Account</h2>
      <form className={styles.form} onSubmit={handleGizmoValidation}>
        <div className={styles.inputWrapper}>
          <AiOutlineUser className={styles.inputIcon} />
          <input
            type="text"
            placeholder="Merrouch Username"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase()})}
            pattern="[a-z0-9._%+\-]+"
            title="Username must be lowercase letters, numbers, or special characters (._%+-)"
          />
        </div>
        <div className={styles.inputWrapper}>
          <AiOutlineLock className={styles.inputIcon} />
          <input
            type="password"
            placeholder="Merrouch Password"
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
            'Link Account'
          )}
        </button>
        <button 
          type="button" 
          className={styles.backButton}
          onClick={() => handleStepChange('LOGIN')}
        >
          Back to Login
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

    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();
      if (queryError) throw queryError;
      if (data) {
        return { isValid: false, message: 'Email already exists' };
      }
    } catch (err) {
      console.error('validateEmail error (treated as available):', err);
      // On error, assume email is available to avoid blocking user
      return { isValid: true, message: '' };
    }

    return { isValid: true, message: 'Email is available' };
  };

  // Handle email change with validation
  const handleEmailChange = async (e) => {
    const email = e.target.value;
    setFormData(prev => ({ ...prev, email }));
    // Run validation against the trimmed email with error handling
    try {
      const emailValidation = await validateEmail(email.trim());
      setValidation(prev => ({ ...prev, email: emailValidation }));
    } catch (err) {
      console.error('handleEmailChange caught unexpected error:', err);
      // Do not block user on unexpected errors
      setValidation(prev => ({
        ...prev,
        email: { isValid: true, message: '' }
      }));
    }
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

    // Trim all string inputs
    const trimmedData = {
      ...formData,
      username: formData.username.trim().toLowerCase(),
      email: formData.email.trim()
    };

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
        username: trimmedData.username,
        email: trimmedData.email,
        password: formData.password,
        gizmoId: validatedGizmoData.gizmoId
      });

      if (success) {
        handleStepChange('SUCCESS');
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
          onClick={() => handleStepChange('VALIDATE')}
        >
          Back
        </button>
      </form>
    </div>
  );

  // Success step
  const renderSuccessStep = () => {
    return (
      <div className={styles.stepContainer}>
        <div className={styles.successIconContainer}>
          <AiOutlineCheckCircle className={styles.successIcon} />
        </div>
        <h2>Account Created!</h2>
        <p className={styles.successText}>
          Welcome to MerrouchGaming! You've been automatically logged in.
        </p>
        <button 
          className={styles.continueButton}
          onClick={handleClose}
        >
          Continue
        </button>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 'LOGIN':
        return renderLoginStep();
      case 'VALIDATE':
        return renderValidateStep();
      case 'CREATE':
        return renderCreateStep();
      case 'SUCCESS':
        return renderSuccessStep();
      default:
        return renderLoginStep();
    }
  };

  // Add effect: show toast when entering SUCCESS
  React.useEffect(() => {
    if (step === 'SUCCESS') {
      toast.success('Account created successfully!', {
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #FFD700',
        },
        iconTheme: {
          primary: '#FFD700',
          secondary: '#333',
        },
        duration: 5000
      });
    }
  }, [step]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay}>
        <div 
          className={styles.modalBackdrop}
          onClick={handleClose}
        />
        <div className={styles.modal}>
          <button 
            className={styles.closeButton} 
            onClick={handleClose}
            disabled={isLoading}
          >
            &times;
          </button>
          
          {error && <div className={styles.error}>{error}</div>}
          {renderStep()}
        </div>
      </div>
      
      <PasswordResetModal 
        isOpen={showPasswordReset} 
        onClose={() => setShowPasswordReset(false)} 
      />
    </>
  );
};

export default LoginModal;