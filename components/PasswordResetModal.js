import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/PasswordResetModal.module.css';

const PasswordResetModal = ({ isOpen, onClose }) => {
  const { supabase } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Check if user exists with this email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();
      
      if (userError || !userData) {
        setError('No account found with this email address');
        setIsLoading(false);
        return;
      }
      
      // Send password reset email using Supabase
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/reset-password`
        }
      );
      
      if (resetError) {
        console.error('Password reset error:', resetError);
        setError('Failed to send reset email. Please try again.');
        setIsLoading(false);
        return;
      }
      
      setIsSuccess(true);
      setIsLoading(false);
      
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setEmail('');
      }, 3000);
      
    } catch (error) {
      console.error('Password reset error:', error);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setIsSuccess(false);
    onClose();
  };

  // Handle conditional rendering based on state
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modalBackdrop} onClick={handleClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
        
        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>Reset Password</h2>
          
          {isSuccess ? (
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>✓</div>
              <p>Password reset email sent!</p>
              <p className={styles.successSubtext}>
                Check your inbox and click the link to reset your password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <p className={styles.description}>
                Enter your email address and we'll send you a link to reset your password.
              </p>
              
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className={styles.input}
                  required
                  disabled={isLoading}
                />
              </div>
              
              {error && (
                <div className={styles.error}>{error}</div>
              )}
              
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <span className={styles.loadingWrapper}>
                    <span className={styles.loadingIcon}>⟳</span>
                    Sending...
                  </span>
                ) : (
                  'Send Reset Email'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordResetModal; 