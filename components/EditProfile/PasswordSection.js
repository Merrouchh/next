import { useState } from 'react';
import styles from '../../styles/EditProfile.module.css';
import { AiOutlineLock, AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';

const PasswordSection = ({ 
  websiteAccount, 
  setWebsiteAccount, 
  message, 
  setMessage, 
  isLoading, 
  setIsLoading,
  showPasswords,
  togglePasswordVisibility
}) => {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, password: true }));
    setMessage(prev => ({ ...prev, password: { type: '', text: '' } }));

    // Validate input
    if (!websiteAccount.currentPasswordForPasswordChange) {
      setMessage(prev => ({ 
        ...prev, 
        password: { type: 'error', text: 'Current password is required' }
      }));
      setIsLoading(prev => ({ ...prev, password: false }));
      return;
    }

    if (!websiteAccount.newPassword) {
      setMessage(prev => ({ 
        ...prev, 
        password: { type: 'error', text: 'New password is required' }
      }));
      setIsLoading(prev => ({ ...prev, password: false }));
      return;
    }

    // Validate minimum password length
    if (websiteAccount.newPassword.length < 6) {
      setMessage(prev => ({ 
        ...prev, 
        password: { type: 'error', text: 'Password must be at least 6 characters long' }
      }));
      setIsLoading(prev => ({ ...prev, password: false }));
      return;
    }

    // Check if new password is the same as current password
    if (websiteAccount.newPassword === websiteAccount.currentPasswordForPasswordChange) {
      setMessage(prev => ({ 
        ...prev, 
        password: { type: 'error', text: 'New password should be different from the current password' }
      }));
      setIsLoading(prev => ({ ...prev, password: false }));
      return;
    }

    if (websiteAccount.newPassword !== websiteAccount.confirmPassword) {
      setMessage(prev => ({ 
        ...prev, 
        password: { type: 'error', text: 'Passwords do not match' }
      }));
      setIsLoading(prev => ({ ...prev, password: false }));
      return;
    }

    try {
      // Call API to update password
      const response = await fetch('/api/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: websiteAccount.currentPasswordForPasswordChange,
          newPassword: websiteAccount.newPassword
        }),
      }).catch(error => {
        console.error('Fetch error:', error);
        throw new Error('Network error occurred');
      });

      // Check if response exists before trying to parse JSON
      if (!response) {
        throw new Error('No response received from server');
      }

      const data = await response.json().catch(error => {
        console.error('JSON parse error:', error);
        throw new Error('Failed to parse server response');
      });

      if (!response.ok) {
        // Special handling for incorrect password
        if (response.status === 401 && data.code === 'INCORRECT_PASSWORD') {
          setMessage(prev => ({ 
            ...prev, 
            password: { type: 'error', text: 'Current password is incorrect' }
          }));
          setIsLoading(prev => ({ ...prev, password: false }));
          return;
        }
        throw new Error(data.message || 'Failed to update password');
      }

      // Clear password fields after successful update
      setWebsiteAccount(prev => ({
        ...prev,
        currentPasswordForPasswordChange: '',
        newPassword: '',
        confirmPassword: ''
      }));

      // Reset the change state
      setIsChangingPassword(false);

      setMessage(prev => ({ 
        ...prev, 
        password: { type: 'success', text: 'Password updated successfully!' }
      }));
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setMessage(prev => ({
          ...prev,
          password: { type: '', text: '' }
        }));
      }, 5000);
    } catch (error) {
      console.error('Password update error:', error);
      setMessage(prev => ({ 
        ...prev, 
        password: { type: 'error', text: error.message || 'Failed to update password' }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, password: false }));
    }
  };

  return (
    <div className={styles.subsection}>
      <h3>Password</h3>
      
      {message.password?.text && (
        <div className={`${styles.message} ${styles[message.password.type]}`} style={{ marginBottom: '1rem' }}>
          {message.password.text}
        </div>
      )}
      
      <div style={{ marginBottom: '1.5rem' }}>
        <div className={styles.passwordStatus} style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className={styles.changeButton}
            style={{ 
              padding: '12px 20px', 
              fontSize: '1rem',
              minWidth: '180px'
            }}
            onClick={() => {
              setIsChangingPassword(!isChangingPassword);
              if (!isChangingPassword) {
                // Reset password fields when starting to change
                setWebsiteAccount(prev => ({
                  ...prev,
                  currentPasswordForPasswordChange: '',
                  newPassword: '',
                  confirmPassword: ''
                }));
              }
            }}
            disabled={isLoading.password}
          >
            {isChangingPassword ? 'Cancel' : 'Change Password'}
          </button>
        </div>
      </div>
      
      {isChangingPassword && (
        <form onSubmit={handlePasswordUpdate} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Current Password</label>
            <div className={styles.inputWrapper}>
              <AiOutlineLock className={styles.icon} />
              <input
                type={showPasswords.currentPasswordForPasswordChange ? "text" : "password"}
                value={websiteAccount.currentPasswordForPasswordChange}
                onChange={(e) => setWebsiteAccount(prev => ({ 
                  ...prev, 
                  currentPasswordForPasswordChange: e.target.value 
                }))}
                placeholder="Enter current password"
              />
              <button 
                type="button"
                className={styles.eyeIcon}
                tabIndex="-1"
                onClick={() => togglePasswordVisibility('currentPasswordForPasswordChange')}
                aria-label={showPasswords.currentPasswordForPasswordChange ? "Hide password" : "Show password"}
              >
                {showPasswords.currentPasswordForPasswordChange ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
              </button>
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label>New Password</label>
            <div className={styles.inputWrapper}>
              <AiOutlineLock className={styles.icon} />
              <input
                type={showPasswords.newPassword ? "text" : "password"}
                value={websiteAccount.newPassword}
                onChange={(e) => setWebsiteAccount(prev => ({ 
                  ...prev, 
                  newPassword: e.target.value 
                }))}
                placeholder="Enter new password"
                minLength={6}
              />
              <button 
                type="button"
                className={styles.eyeIcon}
                tabIndex="-1"
                onClick={() => togglePasswordVisibility('newPassword')}
                aria-label={showPasswords.newPassword ? "Hide password" : "Show password"}
              >
                {showPasswords.newPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
              </button>
            </div>
            <small className={styles.inputHint}>
              Must be at least 6 characters long
            </small>
          </div>
          <div className={styles.inputGroup}>
            <label>Confirm New Password</label>
            <div className={styles.inputWrapper}>
              <AiOutlineLock className={styles.icon} />
              <input
                type={showPasswords.confirmPassword ? "text" : "password"}
                value={websiteAccount.confirmPassword}
                onChange={(e) => setWebsiteAccount(prev => ({ 
                  ...prev, 
                  confirmPassword: e.target.value 
                }))}
                placeholder="Confirm new password"
                minLength={6}
              />
              <button 
                type="button"
                className={styles.eyeIcon}
                tabIndex="-1"
                onClick={() => togglePasswordVisibility('confirmPassword')}
                aria-label={showPasswords.confirmPassword ? "Hide password" : "Show password"}
              >
                {showPasswords.confirmPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading.password}
          >
            {isLoading.password ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
};

export default PasswordSection; 