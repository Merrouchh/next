import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/EditProfile.module.css';
import { AiOutlineUser, AiOutlineMail, AiOutlinePhone, AiOutlineLock } from 'react-icons/ai';
import { FaGamepad } from 'react-icons/fa';
import Head from 'next/head';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { useRouter } from 'next/router';
import EmailSection from '../components/EditProfile/EmailSection';
import PhoneSection from '../components/EditProfile/PhoneSection';
import PasswordSection from '../components/EditProfile/PasswordSection';
import GamingSection from '../components/EditProfile/GamingSection';
import EditProfileModal from '../components/EditProfile/EditProfileModal';

const EditProfile = () => {
  const router = useRouter();
  const { user, supabase, refreshUserData } = useAuth();
  
  // State for user account data
  const [websiteAccount, setWebsiteAccount] = useState({
    email: '',
    phone: '',
    emailPassword: '',  // Separate password for email section
    phonePassword: '',  // Separate password for phone section
    newPassword: '',
    confirmPassword: '',
    currentPasswordForPasswordChange: ''
  });
  
  const [gamingAccount, setGamingAccount] = useState({
    username: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Loading states
  const [isLoading, setIsLoading] = useState({
    website: false,
    gaming: false,
    email: false,
    phone: false,
    password: false,
    cancel: false,
    emailResend: false
  });
  
  // UI message states
  const [message, setMessage] = useState({
    website: { type: '', text: '' },
    gaming: { type: '', text: '' },
    email: { type: '', text: '' },
    phone: { type: '', text: '' },
    password: { type: '', text: '' }
  });

  // Password visibility toggles
  const [showPasswords, setShowPasswords] = useState({
    emailPassword: false,
    phonePassword: false,
    newPassword: false,
    confirmPassword: false,
    currentPasswordForPasswordChange: false,
    gamingCurrentPassword: false,
    gamingNewPassword: false,
    gamingConfirmPassword: false
  });

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Track phone verification state
  const [phoneVerification, setPhoneVerification] = useState({
    isPending: false,
    pendingPhone: '',
    otpCode: ''
  });

  // Modal states for each section
  const [activeModal, setActiveModal] = useState(null);

  // Modal section titles
  const modalTitles = {
    email: "Edit Email Address",
    phone: "Edit Phone Number",
    password: "Change Password",
    gaming: "Gaming Account Settings"
  };

  // Open a specific modal
  const openModal = (modalName) => {
    setActiveModal(modalName);
  };

  // Close the active modal
  const closeModal = () => {
    setActiveModal(null);
  };

  // Update form with user data when available
  useEffect(() => {
    if (user) {
      setWebsiteAccount(prev => ({
        ...prev,
        email: user.email || '',
        phone: user.phone || ''
      }));
      
      setGamingAccount(prev => ({
        ...prev,
        username: user.username || ''
      }));
    }
  }, [user]);

  // Check for coming back from verification success via query parameters
  useEffect(() => {
    if (router.query.verified === 'true' && router.query.type === 'email_change') {
      // Handle the success case directly without immediately refreshing
      console.log('Detected successful verification from URL parameters');
      
      setMessage(prev => ({
        ...prev,
        email: {
          type: 'success',
          text: 'Email verification completed successfully!'
        }
      }));
      
      // Clear the query parameter after showing success message
      const { verified, type, ...restQuery } = router.query;
      router.replace({
        pathname: router.pathname,
        query: restQuery
      }, undefined, { shallow: true });
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setMessage(prev => ({
          ...prev,
          email: { type: '', text: '' }
        }));
      }, 5000);
      
      // Only refresh user data once after a delay
      setTimeout(() => {
        refreshUserData().then(() => {
          console.log('User data refreshed after successful verification');
        }).catch(error => {
          console.warn('Error refreshing user data after verification:', error);
        });
      }, 2000);
    }
  }, [router.query, router, refreshUserData]);

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
          
          {/* Options Cards */}
          <div className={styles.optionsGrid}>
            {/* Email Card */}
            <div className={styles.optionCard} onClick={() => openModal('email')}>
              <div className={styles.optionIcon}>
                <AiOutlineMail />
              </div>
              <div className={styles.optionDetails}>
                <h3>Email Address</h3>
                <p>{user?.email || 'No email set'}</p>
              </div>
            </div>
            
            {/* Phone Card */}
            <div className={styles.optionCard} onClick={() => openModal('phone')}>
              <div className={styles.optionIcon}>
                <AiOutlinePhone />
              </div>
              <div className={styles.optionDetails}>
                <h3>Phone Number</h3>
                <p>{user?.phone || 'No phone set'}</p>
              </div>
            </div>
            
            {/* Password Card */}
            <div className={styles.optionCard} onClick={() => openModal('password')}>
              <div className={styles.optionIcon}>
                <AiOutlineLock />
              </div>
              <div className={styles.optionDetails}>
                <h3>Password</h3>
                <p>Update your account password</p>
              </div>
            </div>
            
            {/* Gaming Card */}
            <div className={styles.optionCard} onClick={() => openModal('gaming')}>
              <div className={styles.optionIcon}>
                <FaGamepad />
              </div>
              <div className={styles.optionDetails}>
                <h3>Gaming Account</h3>
                <p>{user?.username ? `Username: ${user.username}` : 'Set up your gaming account'}</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Modals */}
        {/* Email Modal */}
        <EditProfileModal
          isOpen={activeModal === 'email'}
          onClose={closeModal}
          title={modalTitles.email}
        >
          <EmailSection 
            user={user}
            supabase={supabase}
            websiteAccount={websiteAccount}
            setWebsiteAccount={setWebsiteAccount}
            message={message}
            setMessage={setMessage}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            showPasswords={showPasswords}
            togglePasswordVisibility={togglePasswordVisibility}
          />
        </EditProfileModal>
        
        {/* Phone Modal */}
        <EditProfileModal
          isOpen={activeModal === 'phone'}
          onClose={closeModal}
          title={modalTitles.phone}
        >
          <PhoneSection 
            user={user}
            supabase={supabase}
            websiteAccount={websiteAccount}
            setWebsiteAccount={setWebsiteAccount}
            phoneVerification={phoneVerification}
            setPhoneVerification={setPhoneVerification}
            message={message}
            setMessage={setMessage}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            showPasswords={showPasswords}
            togglePasswordVisibility={togglePasswordVisibility}
          />
        </EditProfileModal>
        
        {/* Password Modal */}
        <EditProfileModal
          isOpen={activeModal === 'password'}
          onClose={closeModal}
          title={modalTitles.password}
        >
          <PasswordSection 
            websiteAccount={websiteAccount}
            setWebsiteAccount={setWebsiteAccount}
            message={message}
            setMessage={setMessage}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            showPasswords={showPasswords}
            togglePasswordVisibility={togglePasswordVisibility}
          />
        </EditProfileModal>
        
        {/* Gaming Modal */}
        <EditProfileModal
          isOpen={activeModal === 'gaming'}
          onClose={closeModal}
          title={modalTitles.gaming}
        >
          <GamingSection />
        </EditProfileModal>
      </div>
    </ProtectedPageWrapper>
  );
};

export default EditProfile; 