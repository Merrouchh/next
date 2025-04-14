import { useState, useEffect, useRef, useReducer } from 'react';
import styles from '../../styles/EditProfile.module.css';
import { AiOutlineMail, AiOutlineLock, AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { useAuth } from '../../contexts/AuthContext';

const EmailSection = ({ 
  user, 
  supabase, 
  websiteAccount, 
  setWebsiteAccount, 
  setMessage,
  message,
  isLoading, 
  setIsLoading,
  showPasswords,
  togglePasswordVisibility,
}) => {
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailUpdatePending, setEmailUpdatePending] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState(null);
  const { refreshUserData } = useAuth();
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const checkCountRef = useRef(0);
  // Add a forceUpdate mechanism
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  // Add resend cooldown tracking
  const [lastResendTime, setLastResendTime] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Add a timer to update the countdown every second and the resend cooldown every second
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      forceUpdate();
      
      // Also update the resend cooldown if it's active
      if (resendCooldown > 0) {
        setResendCooldown(prev => Math.max(0, prev - 1));
      }
    }, 1000); // Update every second for smoother cooldown display
    
    return () => clearInterval(countdownInterval);
  }, [resendCooldown]);

  // Limit how many verification checks can happen on component mount
  useEffect(() => {
    // Reset check counter on component unmount
    return () => {
      checkCountRef.current = 0;
    };
  }, []);

  // Set initial email when user is loaded and check pending verification
  useEffect(() => {
    if (user?.email && websiteAccount.email === '') {
      setWebsiteAccount(prev => ({
        ...prev,
        email: user.email
      }));
    }
    
    // Check if there's a pending verification
    const checkPendingVerification = async () => {
      if (!user?.id || isCheckingVerification || checkCountRef.current >= 10) return;
      
      setIsCheckingVerification(true);
      
      try {
        // Use the API instead of direct Supabase query to avoid 406 errors
        const response = await fetch('/api/email/check-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.hasPendingRecord && data.pendingRecord) {
          console.log('Found pending verification via API:', data.pendingRecord);
          setVerificationDetails(data.pendingRecord);
          setEmailUpdatePending(true);
        } else {
          console.log('No valid pending verification found, resetting state');
          setEmailUpdatePending(false);
          setVerificationDetails(null);
        }
      } catch (error) {
        console.error('Error in verification check:', error);
      } finally {
        setIsCheckingVerification(false);
      }
    };
    
    // Only run the check if we haven't reached the limit
    if (checkCountRef.current < 3) {
      checkPendingVerification();
      // Increment the check counter
      checkCountRef.current += 1;
    }
    
    // Set up interval to periodically check verification status (much less frequently)
    const intervalId = setInterval(() => {
      if (checkCountRef.current < 10) {
        checkPendingVerification();
        // Don't increment the counter for interval checks
        // This ensures we only count initial checks against the small limit
      }
    }, 600000); // Check every 10 minutes instead of every 5 minutes
    
    return () => {
      clearInterval(intervalId);
    };
  }, [user?.id, isCheckingVerification]);

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, email: true }));
    setMessage(prev => ({ ...prev, email: { type: '', text: '' } }));

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (websiteAccount.email && !emailRegex.test(websiteAccount.email)) {
      setMessage(prev => ({ 
        ...prev, 
        email: { type: 'error', text: 'Please enter a valid email address' }
      }));
      setIsLoading(prev => ({ ...prev, email: false }));
      return;
    }

    // Validate current password is provided
    if (!websiteAccount.emailPassword) {
      setMessage(prev => ({ 
        ...prev, 
        email: { type: 'error', text: 'Current password is required' }
      }));
      setIsLoading(prev => ({ ...prev, email: false }));
      return;
    }

    // Check if email has been changed
    const emailChanged = websiteAccount.email.toLowerCase() !== user.email.toLowerCase();

    // If email hasn't changed, show message
    if (!emailChanged) {
      setMessage(prev => ({ 
        ...prev, 
        email: { type: 'error', text: 'New email address is the same as current one' }
      }));
      setIsLoading(prev => ({ ...prev, email: false }));
      return;
    }

    try {
      // Verify the user's password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: websiteAccount.emailPassword
      });
      
      if (signInError) {
        console.error('Password verification failed:', signInError.message);
        
        // Special handling for password errors to prevent Next.js overlay
        if (signInError.message.includes('Invalid login credentials')) {
          setMessage(prev => ({ 
            ...prev, 
            email: { type: 'error', text: 'Invalid password. Please try again.' }
          }));
          setIsLoading(prev => ({ ...prev, email: false }));
          return;
        }
        
        throw new Error('Invalid password. Please try again.');
      }
      
      // Store password temporarily for auto sign-in if needed (for 10 minutes)
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('temp_password', websiteAccount.emailPassword);
        setTimeout(() => {
          sessionStorage.removeItem('temp_password');
        }, 10 * 60 * 1000);
      }
      
      // Prepare the redirect URL for the verification process
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectUrl = new URL('/auth/verification-success', siteUrl);
      
      // Add type parameter to the redirectTo URL
      redirectUrl.searchParams.append('type', 'email_change');
      redirectUrl.searchParams.append('verified', 'true');
      
      // First create a record in our custom email_verifications table
      // This allows us to track more detailed status information
      console.log('Inserting new verification record for user', user.id, 'email:', websiteAccount.email);
      
      // Use the admin API to create the verification record instead of direct DB access
      try {
        const response = await fetch('/api/email/create-verification-record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            currentEmail: user.email,
            newEmail: websiteAccount.email
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          console.log('Successfully created verification record via API:', data.record);
          setVerificationDetails(data.record);
        } else {
          console.error('Error creating verification record via API:', data.error);
        }
      } catch (apiError) {
        console.error('Exception calling create-verification API:', apiError);
      }
      
      // Update email in Supabase - this will send a verification email
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        email: websiteAccount.email,
        options: {
          emailRedirectTo: redirectUrl.toString()
        }
      });
      
      if (updateError) {
        throw new Error(updateError.message || 'Failed to update email');
      }
      
      // Clear password field after successful request
      setWebsiteAccount(prev => ({
        ...prev,
        emailPassword: ''
      }));
      
      // Immediately set email update as pending - don't wait for refresh
      setEmailUpdatePending(true);
      
      // Exit edit mode
      setIsChangingEmail(false);
      
      // Show success message
      setMessage(prev => ({ 
        ...prev, 
        email: { 
          type: 'success', 
          text: 'Verification email sent. Please check your inbox and click the link to complete the change.'
        }
      }));
      
      // Force a check of verification status through the API after a short delay
      // to allow time for the database to update
      setTimeout(async () => {
        try {
          console.log('Checking email verification status through API');
          const response = await fetch('/api/email/check-verification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id
            })
          });
            
          const data = await response.json();
          
          if (response.ok && data.hasPendingRecord && data.pendingRecord) {
            console.log('Found verification record:', data.pendingRecord);
            setVerificationDetails(data.pendingRecord);
            setEmailUpdatePending(true);
          }
        } catch (e) {
          console.warn('Exception during verification check:', e);
        }
      }, 1000); // Wait a second to ensure DB operations complete
      
    } catch (error) {
      console.error('Error updating email:', error);
      
      setMessage(prev => ({ 
        ...prev, 
        email: { 
          type: 'error', 
          text: error.message || 'Failed to update email. Please try again.' 
        }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, email: false }));
    }
  };
  
  const cancelEmailChange = async () => {
    try {
      setIsLoading(prev => ({ ...prev, cancel: true }));
      
      // First make the API call to cancel
      const response = await fetch('/api/cancel-email-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel email change');
      }
      
      // Set a flag to prevent any verification checks
      checkCountRef.current = 999;
      
      // Start the transition
      const infoBox = document.querySelector(`.${styles.info}`);
      if (infoBox) {
        infoBox.style.opacity = '0';
        infoBox.style.transform = 'translateY(-10px)';
        infoBox.style.maxHeight = '0';
        infoBox.style.marginBottom = '0';
      }
      
      // Wait for the transition to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update state after transition
      setVerificationDetails(null);
      setEmailUpdatePending(false);
      
      // Exit change mode if active
      setIsChangingEmail(false);
      
      // Reset the email input to current email
      setWebsiteAccount(prev => ({
        ...prev,
        email: user.email || '',
        emailPassword: ''
      }));
      
      // After a longer delay (5 seconds), reset the check counter to allow future checks
      setTimeout(() => {
        checkCountRef.current = 0;
      }, 5000);
      
    } catch (error) {
      console.error('Error cancelling email change:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, cancel: false }));
    }
  };

  // Add a new function to handle resending the verification email
  const resendVerificationEmail = async () => {
    // Check if we're still in cooldown period
    const now = Date.now();
    const cooldownPeriod = 60; // 60 seconds cooldown
    
    if (lastResendTime > 0) {
      const elapsedSeconds = Math.floor((now - lastResendTime) / 1000);
      
      if (elapsedSeconds < cooldownPeriod) {
        // Still in cooldown, update the cooldown counter and show message
        const remainingSeconds = cooldownPeriod - elapsedSeconds;
        setResendCooldown(remainingSeconds);
        
        setMessage(prev => ({
          ...prev,
          email: { 
            type: 'info', 
            text: `Please wait ${remainingSeconds} seconds before resending the verification email.` 
          }
        }));
        
        return;
      }
    }
    
    try {
      setIsLoading(prev => ({ ...prev, emailResend: true }));
      
      // Update lastResendTime immediately to prevent double-clicks
      setLastResendTime(now);
      setResendCooldown(cooldownPeriod);
      
      // Show working message
      setMessage(prev => ({
        ...prev,
        email: { type: 'info', text: 'Resending verification email...' }
      }));
      
      // Update the verification record with a new expiration time
      // We do this BEFORE sending the email to ensure the UI updates even if email fails
      try {
        // Call the API to update the expiration time
        const updateResponse = await fetch('/api/email/update-verification-expiry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            email: verificationDetails.new_email
          })
        });
        
        // Handle rate limiting response
        if (updateResponse.status === 429) {
          const rateLimitData = await updateResponse.json();
          setResendCooldown(rateLimitData.remainingSeconds || 60);
          
          setMessage(prev => ({
            ...prev,
            email: { 
              type: 'info', 
              text: rateLimitData.message || 'You are sending too many requests. Please wait before trying again.'
            }
          }));
          
          setIsLoading(prev => ({ ...prev, emailResend: false }));
          return;
        }
        
        if (updateResponse.ok) {
          const result = await updateResponse.json();
          
          if (result.success && result.record) {
            // Update the verification details with new expiration time
            setVerificationDetails(result.record);
            console.log('Updated verification expiry:', result.record);
            
            // Force UI refresh
            setEmailUpdatePending(false);
            setTimeout(() => setEmailUpdatePending(true), 50);
          }
        }
      } catch (refreshError) {
        // Don't fail if this part fails, just log the error
        console.warn('Failed to update expiration time:', refreshError);
      }
      
      // Call Supabase to resend verification with the same email
      const { error: updateError } = await supabase.auth.updateUser({
        email: verificationDetails.new_email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verification-success?type=email_change&verified=true`
        }
      });
      
      if (updateError) {
        throw new Error(updateError.message || 'Failed to resend verification email');
      }
      
      // Show success message
      setMessage(prev => ({
        ...prev,
        email: { type: 'success', text: 'Verification email resent successfully. Please check your inbox.' }
      }));
      
      // Clear the success message after 5 seconds
      setTimeout(() => {
        setMessage(prev => ({
          ...prev,
          email: { type: '', text: '' }
        }));
      }, 5000);
      
    } catch (error) {
      console.error('Error resending verification email:', error);
      setMessage(prev => ({
        ...prev,
        email: { type: 'error', text: error.message || 'Failed to resend verification email. Please try again.' }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, emailResend: false }));
    }
  };

  // Get human-readable time remaining for verification expiration
  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return '';
    
    const expires = new Date(expiresAt);
    const now = new Date();
    
    if (expires <= now) return 'Expired';
    
    const diffMs = expires - now;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHrs > 0) {
      return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} and ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    } else {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    }
  };

  // Add CSS styles for the verification actions
  const actionStyles = {
    verificationActions: {
      display: 'flex',
      gap: '10px',
      marginTop: '15px'
    },
    resendButton: {
      backgroundColor: '#2ea44f',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '8px 12px',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    }
  };

  return (
    <div className={styles.subsection}>
      <h3>Email Address</h3>
      {verificationDetails && verificationDetails.status === 'pending' && verificationDetails.new_email && (
        <div 
          className={`${styles.message} ${styles.info}`}
          style={{
            display: 'block',
            visibility: 'visible',
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(3, 102, 214, 0.1)',
            border: '1px solid rgba(3, 102, 214, 0.3)',
            color: '#58a6ff',
            transition: 'all 0.3s ease-in-out',
            opacity: 1,
            transform: 'translateY(0)',
            maxHeight: '500px',
            overflow: 'hidden'
          }}
        >
          <p><strong>Email verification pending!</strong></p>
          <p>We've sent a confirmation link to <strong>{verificationDetails.new_email}</strong></p>
          <p>Please check your email inbox and click the confirmation link to complete the change.</p>
          <p>You can continue using the site with your current email until verification is complete.</p>
          
          {verificationDetails?.expires_at && (
            <p key={verificationDetails.expires_at}>
              <small>Verification expires in: {getTimeRemaining(verificationDetails.expires_at)}</small>
            </p>
          )}
          
          {verificationDetails?.created_at && (
            <p><small>Requested: {new Date(verificationDetails.created_at).toLocaleString()}</small></p>
          )}
          
          <div style={actionStyles.verificationActions}>
            <button
              onClick={cancelEmailChange}
              className={styles.cancelButton}
              disabled={isLoading.cancel || isLoading.emailResend}
            >
              {isLoading.cancel ? 'Cancelling...' : 'Cancel Email Change'}
            </button>
            
            <button
              onClick={resendVerificationEmail}
              style={{
                ...actionStyles.resendButton,
                ...(resendCooldown > 0 && { 
                  opacity: 0.7, 
                  cursor: 'not-allowed',
                  backgroundColor: '#666'
                })
              }}
              disabled={isLoading.cancel || isLoading.emailResend || resendCooldown > 0}
            >
              {isLoading.emailResend 
                ? 'Sending...' 
                : resendCooldown > 0 
                  ? `Resend (${resendCooldown}s)` 
                  : 'Resend Verification Email'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleEmailUpdate} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Email Address</label>
          <div className={styles.phoneInputWithButton}>
            <div className={`${styles.inputWrapper} ${!isChangingEmail && user?.email ? styles.readOnlyInput : ''}`}>
              <AiOutlineMail className={styles.icon} />
              <input
                type="email"
                value={websiteAccount.email}
                onChange={(e) => setWebsiteAccount(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Your email address"
                required
                tabIndex="0"
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && !e.shiftKey && isChangingEmail) {
                    // Find the password input and focus it
                    const passwordInput = document.querySelector('input[name="emailPassword"]');
                    if (passwordInput) {
                      e.preventDefault();
                      passwordInput.focus();
                    }
                  }
                }}
                disabled={(!isChangingEmail && user?.email) || 
                          (verificationDetails?.status === 'pending' && 
                           verificationDetails.new_email && 
                           verificationDetails.new_email.includes('@'))}
                style={{ maxWidth: "100%", width: "100%" }}
              />
            </div>
            <button
              type="button"
              className={styles.changeButton}
              tabIndex="2"
              onClick={() => {
                setIsChangingEmail(!isChangingEmail);
                if (!isChangingEmail) {
                  // Reset password field when starting to change
                  setWebsiteAccount(prev => ({ ...prev, emailPassword: '' }));
                }
              }}
              disabled={(verificationDetails?.status === 'pending' && 
                        verificationDetails.new_email && 
                        verificationDetails.new_email.includes('@'))}
            >
              {user?.email ? (isChangingEmail ? 'Cancel' : 'Change') : 'Add'}
            </button>
          </div>
          <small className={styles.inputHint}>
            {isChangingEmail || !user?.email 
              ? 'Enter your new email address' 
              : 'Your verified email address'}
          </small>
        </div>
        {(isChangingEmail || !user?.email) && 
         !(verificationDetails?.status === 'pending' && verificationDetails.new_email) && (
          <div className={styles.inputGroup}>
            <label>Password Verification</label>
            <div className={styles.inputWrapper}>
              <AiOutlineLock className={styles.icon} />
              <input
                name="emailPassword"
                type={showPasswords.emailPassword ? "text" : "password"}
                value={websiteAccount.emailPassword}
                tabIndex="1"
                onChange={(e) => setWebsiteAccount(prev => ({ 
                  ...prev, 
                  emailPassword: e.target.value 
                }))}
                placeholder="Enter your current password to verify"
              />
              <button
                type="button"
                className={styles.eyeIcon}
                tabIndex="-1"
                onClick={() => togglePasswordVisibility('emailPassword')}
                aria-label={showPasswords.emailPassword ? "Hide password" : "Show password"}
              >
                {showPasswords.emailPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
              </button>
            </div>
            <small className={styles.inputHint}>
              We need your current password to verify your identity
            </small>
          </div>
        )}

        {(isChangingEmail || !user?.email) && 
         !(verificationDetails?.status === 'pending' && verificationDetails.new_email) && (
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading.email}
          >
            {isLoading.email ? 'Updating...' : 'Update Email'}
          </button>
        )}

        {/* Add back the message display */}
        {message.email?.text && (
          <div 
            className={`${styles.message} ${message.email?.type === 'error' ? styles.error : styles.success}`}
            style={{ marginTop: '1rem' }}
          >
            {message.email.text}
          </div>
        )}
      </form>
    </div>
  );
};

export default EmailSection; 