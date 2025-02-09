import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/LoginForm.module.css';

const LoginForm = () => {
  const { login, error, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form state when error changes
  useEffect(() => {
    if (error) {
      setIsSubmitting(false);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting || isLoading) return;

    // Clear any previous errors
    setIsSubmitting(true);

    // Blur inputs to hide mobile keyboard
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      const success = await login(username, password);
      if (!success) {
        setIsSubmitting(false);
      }
    } catch (error) {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={styles.form}
      // Prevent iOS zoom on input focus
      style={{ fontSize: '16px' }}
    >
      <div className={styles.inputGroup}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.trim())}
          placeholder="Username"
          disabled={isSubmitting}
          required
          autoComplete="username"
          autoCapitalize="none"
        />
      </div>
      <div className={styles.inputGroup}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={isSubmitting}
          required
          autoComplete="current-password"
        />
      </div>
      <button 
        type="submit" 
        disabled={isSubmitting || isLoading || !username || !password}
        className={`${styles.loginButton} ${(isSubmitting || isLoading) ? styles.loading : ''}`}
      >
        {isSubmitting || isLoading ? 'Logging in...' : 'Login'}
      </button>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
    </form>
  );
};

export default LoginForm; 