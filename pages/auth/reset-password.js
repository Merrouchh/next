import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Head from 'next/head';
import styles from '../../styles/Auth.module.css';
import { AiOutlineLock, AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';

export default function ResetPassword() {
  const router = useRouter();
  const { supabase } = useAuth();
  const [passwords, setPasswords] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  // Check if we have a valid reset token
  useEffect(() => {
    const checkToken = async () => {
      try {
        // Wait for supabase to be initialized
        if (!supabase) {
          return;
        }
        
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setError('Invalid or expired reset link. Please request a new password reset.');
          setIsCheckingToken(false);
          return;
        }

        // Check if we have a session at all
        if (!session) {
          // Try to extract tokens from URL hash
          const hash = window.location.hash;
          if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const type = hashParams.get('type');
            
            if (accessToken && refreshToken && type === 'recovery') {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (sessionError) {
                console.error('Error setting session:', sessionError);
                setError('Invalid or expired reset link. Please request a new password reset.');
                setIsCheckingToken(false);
                return;
              }
              
              // Continue with the newly set session
            } else {
              setError('Invalid or expired reset link. Please request a new password reset.');
              setIsCheckingToken(false);
              return;
            }
          } else {
            setError('Invalid or expired reset link. Please request a new password reset.');
            setIsCheckingToken(false);
            return;
          }
        }

        // Verify we have a valid user for password recovery
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (!user || userError) {
          console.error('User verification failed:', userError);
          setError('Invalid or expired reset link. Please request a new password reset.');
          setIsCheckingToken(false);
          return;
        }

        console.log('Valid recovery session found for user:', user.email);
        setIsValidToken(true);
        setIsCheckingToken(false);
        
      } catch (error) {
        console.error('Token validation error:', error);
        setError('An error occurred validating your reset link. Please try again.');
        setIsCheckingToken(false);
      }
    };

    if (supabase) {
      checkToken();
    }
  }, [supabase]);

  const validatePasswords = () => {
    if (!passwords.password || !passwords.confirmPassword) {
      setError('Please fill in both password fields');
      return false;
    }

    if (passwords.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (passwords.password !== passwords.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (!validatePasswords()) return;
    
    if (!supabase) {
      setError('Authentication service not available. Please try again.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwords.password
      });
      
      if (updateError) {
        console.error('Password update error:', updateError);
        setError('Failed to update password. Please try again.');
        setIsLoading(false);
        return;
      }
      
      setSuccess(true);
      setIsLoading(false);
      
      // Clear the URL parameters to prevent issues
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        window.history.replaceState({}, '', url.pathname);
      }
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
      
    } catch (error) {
      console.error('Password reset error:', error);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleInputChange = (field, value) => {
    setPasswords(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Reset Password - Merrouch Gaming</title>
        <meta name="description" content="Reset your password for Merrouch Gaming Center" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1>Reset Your Password</h1>
        </div>
        
        <div className={styles.cardBody}>
          {isCheckingToken ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255, 215, 0, 0.2)',
                borderLeft: '3px solid #FFD700',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }}></div>
              <p>Validating reset link...</p>
            </div>
          ) : !isValidToken ? (
            <div style={{ textAlign: 'center' }}>
              <div className={styles.errorIcon}>⚠</div>
              <p className={styles.message}>
                {error || 'Invalid or expired reset link'}
              </p>
              <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Reset links expire after 1 hour for security reasons.
              </p>
              <button 
                className={styles.button}
                onClick={() => router.push('/')}
              >
                Return to Homepage
              </button>
            </div>
          ) : success ? (
            <div style={{ textAlign: 'center' }}>
              <div className={styles.successIcon}>✓</div>
              <p className={styles.message}>
                Password updated successfully!
              </p>
              <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                You can now login with your new password. Redirecting...
              </p>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} style={{ width: '100%' }}>
              <p className={styles.message}>
                Enter your new password below. Make sure it&apos;s secure and easy to remember.
              </p>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  color: '#FFD700',
                  fontSize: '0.9rem'
                }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <AiOutlineLock style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#888',
                    fontSize: '1.2rem'
                  }} />
                  <input
                    type={showPasswords.password ? 'text' : 'password'}
                    value={passwords.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                      border: '2px solid #333',
                      borderRadius: '8px',
                      background: '#2a2a2a',
                      color: '#fff',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('password')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: '1.2rem'
                    }}
                  >
                    {showPasswords.password ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                  </button>
                </div>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  color: '#FFD700',
                  fontSize: '0.9rem'
                }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <AiOutlineLock style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#888',
                    fontSize: '1.2rem'
                  }} />
                  <input
                    type={showPasswords.confirmPassword ? 'text' : 'password'}
                    value={passwords.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.5rem 0.75rem 2.5rem',
                      border: '2px solid #333',
                      borderRadius: '8px',
                      background: '#2a2a2a',
                      color: '#fff',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: '1.2rem'
                    }}
                  >
                    {showPasswords.confirmPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className={styles.errorDetail}>
                  <div className={styles.errorCode}>{error}</div>
                </div>
              )}
              
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.button}
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 