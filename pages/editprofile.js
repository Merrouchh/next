import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/EditProfile.module.css';
import { AiOutlineMail, AiOutlineUser, AiOutlineLock, AiOutlineLink } from 'react-icons/ai';
import { FaGamepad } from 'react-icons/fa';
import Head from 'next/head';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';

const EditProfile = () => {
  const { user } = useAuth();
  const [websiteAccount, setWebsiteAccount] = useState({
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [gamingAccount, setGamingAccount] = useState({
    username: user?.username || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [isLoading, setIsLoading] = useState({
    website: false,
    gaming: false
  });
  
  const [message, setMessage] = useState({
    website: { type: '', text: '' },
    gaming: { type: '', text: '' }
  });

  const handleWebsiteSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, website: true }));
    setMessage(prev => ({ ...prev, website: { type: '', text: '' } }));

    try {
      // Add website account update logic here
      setMessage(prev => ({ 
        ...prev, 
        website: { type: 'success', text: 'Website account updated successfully!' }
      }));
    } catch (error) {
      setMessage(prev => ({ 
        ...prev, 
        website: { type: 'error', text: 'Failed to update website account' }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, website: false }));
    }
  };

  const handleGamingSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, gaming: true }));
    setMessage(prev => ({ ...prev, gaming: { type: '', text: '' } }));

    try {
      // Add gaming account update logic here
      setMessage(prev => ({ 
        ...prev, 
        gaming: { type: 'success', text: 'Gaming account updated successfully!' }
      }));
    } catch (error) {
      setMessage(prev => ({ 
        ...prev, 
        gaming: { type: 'error', text: 'Failed to update gaming account' }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, gaming: false }));
    }
  };

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Edit Profile - Merrouch Gaming</title>
      </Head>
      <div className={styles.container}>
        <h1 className={styles.mainTitle}>Edit Profile</h1>
        
        {/* Website Account Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <AiOutlineUser className={styles.sectionIcon} />
            <h2>Website Account</h2>
          </div>
          <form onSubmit={handleWebsiteSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email</label>
              <div className={styles.inputWrapper}>
                <AiOutlineMail className={styles.icon} />
                <input
                  type="email"
                  value={websiteAccount.email}
                  onChange={(e) => setWebsiteAccount(prev => ({ 
                    ...prev, 
                    email: e.target.value 
                  }))}
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>Current Password</label>
              <div className={styles.inputWrapper}>
                <AiOutlineLock className={styles.icon} />
                <input
                  type="password"
                  value={websiteAccount.currentPassword}
                  onChange={(e) => setWebsiteAccount(prev => ({ 
                    ...prev, 
                    currentPassword: e.target.value 
                  }))}
                  placeholder="Enter current password"
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>New Password</label>
              <div className={styles.inputWrapper}>
                <AiOutlineLock className={styles.icon} />
                <input
                  type="password"
                  value={websiteAccount.newPassword}
                  onChange={(e) => setWebsiteAccount(prev => ({ 
                    ...prev, 
                    newPassword: e.target.value 
                  }))}
                  placeholder="Enter new password (optional)"
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>Confirm New Password</label>
              <div className={styles.inputWrapper}>
                <AiOutlineLock className={styles.icon} />
                <input
                  type="password"
                  value={websiteAccount.confirmPassword}
                  onChange={(e) => setWebsiteAccount(prev => ({ 
                    ...prev, 
                    confirmPassword: e.target.value 
                  }))}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            {message.website.text && (
              <div className={`${styles.message} ${styles[message.website.type]}`}>
                {message.website.text}
              </div>
            )}
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isLoading.website}
            >
              {isLoading.website ? 'Updating...' : 'Update Website Account'}
            </button>
          </form>
        </section>

        {/* Gaming Account Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <FaGamepad className={styles.sectionIcon} />
            <h2>Gaming Account</h2>
          </div>
          <form onSubmit={handleGamingSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Gaming Username</label>
              <div className={styles.inputWrapper}>
                <FaGamepad className={styles.icon} />
                <input
                  type="text"
                  value={gamingAccount.username}
                  disabled
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>Current Password</label>
              <div className={styles.inputWrapper}>
                <AiOutlineLock className={styles.icon} />
                <input
                  type="password"
                  value={gamingAccount.currentPassword}
                  onChange={(e) => setGamingAccount(prev => ({ 
                    ...prev, 
                    currentPassword: e.target.value 
                  }))}
                  placeholder="Enter current gaming password"
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>New Password</label>
              <div className={styles.inputWrapper}>
                <AiOutlineLock className={styles.icon} />
                <input
                  type="password"
                  value={gamingAccount.newPassword}
                  onChange={(e) => setGamingAccount(prev => ({ 
                    ...prev, 
                    newPassword: e.target.value 
                  }))}
                  placeholder="Enter new gaming password"
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>Confirm New Password</label>
              <div className={styles.inputWrapper}>
                <AiOutlineLock className={styles.icon} />
                <input
                  type="password"
                  value={gamingAccount.confirmPassword}
                  onChange={(e) => setGamingAccount(prev => ({ 
                    ...prev, 
                    confirmPassword: e.target.value 
                  }))}
                  placeholder="Confirm new gaming password"
                />
              </div>
            </div>
            {message.gaming.text && (
              <div className={`${styles.message} ${styles[message.gaming.type]}`}>
                {message.gaming.text}
              </div>
            )}
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isLoading.gaming}
            >
              {isLoading.gaming ? 'Updating...' : 'Update Gaming Account'}
            </button>
          </form>
        </section>
      </div>
    </ProtectedPageWrapper>
  );
};

export default EditProfile; 