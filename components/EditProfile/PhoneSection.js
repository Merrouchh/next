import { useState, useRef, useEffect } from 'react';
import styles from '../../styles/EditProfile.module.css';
import { AiOutlineLock, AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import OtpVerificationModal from './OtpVerificationModal';

const PhoneSection = ({
  user,
  supabase,
  websiteAccount,
  setWebsiteAccount,
  phoneVerification,
  setPhoneVerification,
  message,
  setMessage,
  isLoading,
  setIsLoading,
  showPasswords,
  togglePasswordVisibility
}) => {

  const phoneInputRef = useRef(null);
  const [isChangingPhone, setIsChangingPhone] = useState(false);
  const checkCountRef = useRef(0);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState(null);

  // Reference to main phone input container
  const phoneContainerRef = useRef(null);

  // Add state for controlling the modal
  const [showOtpModal, setShowOtpModal] = useState(false);

  // Fix tab order for the phone input after component mounts
  useEffect(() => {
    // Skip if no container or not changing phone
    if (!phoneContainerRef.current) return;
    
    // Find and fix tab navigation elements in the phone input
    const flagButton = phoneContainerRef.current.querySelector('.selected-flag');
    if (flagButton) {
      flagButton.setAttribute('tabindex', '-1');
    }
    
    // Set tabindex for all countries in the dropdown
    const countryItems = phoneContainerRef.current.querySelectorAll('.country');
    countryItems.forEach(item => {
      item.setAttribute('tabindex', '-1');
    });
    
    // Set tabindex for search input
    const searchInput = phoneContainerRef.current.querySelector('.search-box');
    if (searchInput) {
      searchInput.setAttribute('tabindex', '-1');
    }
  }, [isChangingPhone]); // Re-run when change mode toggles

  // Check for pending phone verification on component mount
  useEffect(() => {
    const checkPhoneVerification = async () => {
      if (!user?.id || isCheckingVerification) return;
      
      // Don't run check if we've reached the limit
      if (checkCountRef.current >= 10) {
        console.log('Skipping phone verification check - reached limit or disabled');
        return;
      }
      
      setIsCheckingVerification(true);
      console.log('Checking phone verification status on mount');
      
      try {
        // Check phone_verification_attempts table for pending verification
        const { data: verificationData, error } = await supabase
          .from('phone_verification_attempts')
          .select('*')
          .eq('user_id', user.id)
          .eq('verified', false)
          .eq('otp_sent', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (!error && verificationData) {
          console.log('Found pending phone verification:', verificationData);
          
          // Only update state if we don't have cancellation in progress
          if (checkCountRef.current < 10) {
            setVerificationDetails(verificationData);
            setPhoneVerification({
              isPending: true,
              pendingPhone: verificationData.phone,
              otpCode: ''
            });
          }
        } else {
          console.log('No pending phone verification found');
          setVerificationDetails(null);
          setPhoneVerification({
            isPending: false,
            pendingPhone: '',
            otpCode: ''
          });
        }
      } catch (error) {
        console.warn('Error checking phone verification status:', error);
      } finally {
        setIsCheckingVerification(false);
      }
    };
    
    // Run the check immediately when component mounts
    checkPhoneVerification();
  }, [user?.id, supabase]);

  // Update display when verificationDetails changes
  useEffect(() => {
    if (verificationDetails && !verificationDetails.verified) {
      setPhoneVerification({
        isPending: true,
        pendingPhone: verificationDetails.phone,
        otpCode: ''
      });
    } else if (!verificationDetails) {
      setPhoneVerification({
        isPending: false,
        pendingPhone: '',
        otpCode: ''
      });
    }
  }, [verificationDetails, setPhoneVerification]);

  const formatDisplayPhone = (phoneNumber) => {
    if (!phoneNumber) return '';
    
    // Remove the + prefix if it exists
    return phoneNumber.replace(/^\+/, '');
  };

  const handlePhoneUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, phone: true }));
    setMessage(prev => ({ ...prev, phone: { type: '', text: '' } }));
    
    try {
      // First, check if a phone is provided (if not, we'll set it to empty)
      if (!websiteAccount.phone || websiteAccount.phone.trim() === '') {
        setMessage(prev => ({
          ...prev,
          phone: { type: 'error', text: 'Please enter a phone number' }
        }));
        setIsLoading(prev => ({ ...prev, phone: false }));
        return;
      }
      
      // Ensure phone is in E.164 format
      let formattedPhone = websiteAccount.phone;
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      
      console.log('Phone to verify:', formattedPhone);
      
      // Create a verification record via the API instead of direct database access
      let recordResponse;
      try {
        recordResponse = await fetch('/api/phone/create-verification-record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            phone: formattedPhone
          }),
        });
        
        if (!recordResponse.ok) {
          const errorData = await recordResponse.json();
          console.error('Create verification record API error:', errorData);
          throw new Error(errorData.error || 'Failed to start verification process');
        }
        
        const recordData = await recordResponse.json();
        
        if (!recordData.success || !recordData.record) {
          throw new Error('Failed to create verification record');
        }
        
        // Store the record for later use
        setVerificationDetails(recordData.record);
        
        // Send OTP verification code via our API
        let response;
        try {
          response = await fetch('/api/verify-phone-new', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'send',
              phone: formattedPhone,
              userId: user.id,
              verificationId: recordData.record.id // Pass the verification record ID
            }),
          });
        } catch (fetchError) {
          console.error('Fetch error:', fetchError);
          setMessage(prev => ({
            ...prev,
            phone: { type: 'error', text: 'Network error occurred. Please try again.' }
          }));
          setIsLoading(prev => ({ ...prev, phone: false }));
          return;
        }
        
        let responseData;
        try {
          responseData = await response.json();
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          setMessage(prev => ({
            ...prev,
            phone: { type: 'error', text: 'Failed to parse response. Please try again.' }
          }));
          setIsLoading(prev => ({ ...prev, phone: false }));
          return;
        }
        
        if (!response.ok || responseData.success === false) {
          // Get the error message from the response
          const errorMessage = responseData.message || responseData.error || 'Failed to send verification code';
          
          // Special handling for phone already in use
          if (responseData.error === 'phone_already_used') {
            setMessage(prev => ({
              ...prev,
              phone: { 
                type: 'error', 
                text: 'This phone number is already associated with another account. Please use a different phone number.'
              }
            }));
            setIsLoading(prev => ({ ...prev, phone: false }));
            return;
          }
          
          setMessage(prev => ({
            ...prev,
            phone: { type: 'error', text: errorMessage }
          }));
          setIsLoading(prev => ({ ...prev, phone: false }));
          return;
        }
        
        // Set phone verification pending state
        setPhoneVerification({
          isPending: true,
          pendingPhone: formattedPhone,
          otpCode: ''
        });
        
        // Exit change mode
        setIsChangingPhone(false);
        
        setMessage(prev => ({
          ...prev,
          phone: { 
            type: 'success', 
            text: 'Verification code sent! Please check your WhatsApp and enter the 6-digit code.' 
          }
        }));
        
      } catch (error) {
        console.error('Phone verification error:', error);
        setMessage(prev => ({
          ...prev,
          phone: { 
            type: 'error', 
            text: error.message || 'Failed to send verification code. Please try again later.' 
          }
        }));
      } finally {
        setIsLoading(prev => ({ ...prev, phone: false }));
      }
    } catch (error) {
      console.error('Phone verification error:', error);
      setMessage(prev => ({
        ...prev,
        phone: { 
          type: 'error', 
          text: error.message || 'Failed to send verification code. Please try again later.' 
        }
      }));
    }
  };

  // Update to handle phone verification code entry in modal
  const handleVerifyPhoneOtp = async (code) => {
    // Use provided code or state value
    const otpToVerify = code || phoneVerification.otpCode;
    
    setIsLoading(prev => ({ ...prev, phone: true }));
    
    try {
      if (!otpToVerify || otpToVerify.length !== 6) {
        setMessage(prev => ({
          ...prev,
          phone: { type: 'error', text: 'Please enter a valid 6-digit verification code' }
        }));
        setIsLoading(prev => ({ ...prev, phone: false }));
        return;
      }
      
      console.log('Verifying code:', otpToVerify, 'for phone:', phoneVerification.pendingPhone);
      
      // Verify the OTP through our custom API
      let response;
      try {
        response = await fetch('/api/verify-phone-new', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'verify',
            phone: phoneVerification.pendingPhone,
            code: otpToVerify,
            userId: user.id,
            verificationId: verificationDetails?.id
          }),
        });
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        setMessage(prev => ({
          ...prev,
          phone: { type: 'error', text: 'Network error occurred. Please try again.' }
        }));
        setIsLoading(prev => ({ ...prev, phone: false }));
        return;
      }
      
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        setMessage(prev => ({
          ...prev,
          phone: { type: 'error', text: 'Failed to parse response. Please try again.' }
        }));
        setIsLoading(prev => ({ ...prev, phone: false }));
        return;
      }
      
      // Check for API-level success flag
      if (responseData.success === false) {
        // API returned an error with success: false
        const errorMessage = responseData.message || responseData.error || 'Failed to verify code';
        console.debug('Verification API error:', errorMessage);
        
        // Special handling for phone already in use
        if (responseData.error === 'phone_already_used') {
          setMessage(prev => ({
            ...prev,
            phone: { 
              type: 'error', 
              text: 'This phone number is already associated with another account. Please use a different phone number.'
            }
          }));
          
          // Close modal and reset verification state
          setShowOtpModal(false);
          setPhoneVerification({
            isPending: false,
            pendingPhone: '',
            otpCode: ''
          });
          setVerificationDetails(null);
          
          setIsLoading(prev => ({ ...prev, phone: false }));
          return;
        }
        
        // Handle the error directly without throwing
        setMessage(prev => ({
          ...prev,
          phone: { 
            type: 'error', 
            text: errorMessage
          }
        }));
        
        // Keep the OTP field for retry but clear its value
        setPhoneVerification(prev => ({
          ...prev,
          otpCode: ''
        }));
        
        setIsLoading(prev => ({ ...prev, phone: false }));
        return;
      }
      
      // For backward compatibility, still check HTTP status
      if (!response.ok) {
        // Use the message field if available, otherwise use error or default message
        const errorMessage = responseData.message || responseData.error || 'Failed to verify code';
        console.debug('Verification error:', errorMessage);
        
        // Handle the error directly without throwing
        setMessage(prev => ({
          ...prev,
          phone: { 
            type: 'error', 
            text: errorMessage
          }
        }));
        
        // Keep the OTP field for retry but clear its value
        setPhoneVerification(prev => ({
          ...prev,
          otpCode: ''
        }));
        
        setIsLoading(prev => ({ ...prev, phone: false }));
        return;
      }
      
      // Update verification details
      if (verificationDetails) {
        const updatedDetails = {
          ...verificationDetails,
          verified: true,
          verified_at: new Date().toISOString()
        };
        setVerificationDetails(updatedDetails);
      }
      
      // Reset phone verification state
      setPhoneVerification({
        isPending: false,
        pendingPhone: '',
        otpCode: ''
      });
      
      // Close the modal
      setShowOtpModal(false);
      
      // Update local user state with new phone number
      if (user) {
        user.phone = phoneVerification.pendingPhone;
        
        // Also update the websiteAccount state to ensure consistent display
        setWebsiteAccount(prev => ({
          ...prev,
          phone: phoneVerification.pendingPhone
        }));
      }
      
      setMessage(prev => ({
        ...prev,
        phone: { type: 'success', text: 'Phone number verified and updated successfully!' }
      }));
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setMessage(prev => ({
          ...prev,
          phone: { type: '', text: '' }
        }));
      }, 5000);
      
    } catch (error) {
      // This catch block should never be reached for verification errors
      console.error('Unexpected OTP verification error:', error);
      
      // Display user-friendly error message
      setMessage(prev => ({
        ...prev,
        phone: { 
          type: 'error', 
          text: 'An unexpected error occurred. Please try again.' 
        }
      }));
      
      // Keep the OTP field for retry but clear its value
      setPhoneVerification(prev => ({
        ...prev,
        otpCode: ''
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, phone: false }));
    }
  };

  // Check if verification is pending and open modal automatically
  useEffect(() => {
    if (phoneVerification.isPending && !showOtpModal) {
      setShowOtpModal(true);
    } else if (!phoneVerification.isPending && showOtpModal) {
      setShowOtpModal(false);
    }
  }, [phoneVerification.isPending]);

  const cancelPhoneVerification = async () => {
    try {
      // Immediately update UI state to prevent flashing
      setPhoneVerification({
        isPending: false,
        pendingPhone: '',
        otpCode: ''
      });
      
      setVerificationDetails(null);
      
      // Set flag to prevent verification checks
      checkCountRef.current = 999;
      
      // Reset change mode if active
      setIsChangingPhone(false);
      
      setIsLoading(prev => ({ ...prev, phone: true }));
      
      // Show working message
      setMessage(prev => ({
        ...prev,
        phone: { type: 'info', text: 'Cancelling phone verification...' }
      }));
      
      // Call the server-side API to handle cancellation
      const response = await fetch('/api/phone/cancel-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          phone: phoneVerification.pendingPhone,
          verificationId: verificationDetails?.id
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Cancel verification API error:', errorData);
        throw new Error(errorData.error || 'Failed to cancel verification');
      }
      
      // Show success message
      setMessage(prev => ({
        ...prev,
        phone: { type: 'success', text: 'Phone verification cancelled.' }
      }));
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(prev => ({
          ...prev,
          phone: { type: '', text: '' }
        }));
      }, 3000);
      
      // After a delay, reset the check counter to allow future checks
      setTimeout(() => {
        checkCountRef.current = 0;
      }, 5000);
      
    } catch (error) {
      console.error('Error cancelling phone verification:', error);
      setMessage(prev => ({
        ...prev,
        phone: { type: 'error', text: 'Failed to cancel verification. Please try again.' }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, phone: false }));
    }
  };

  const handleRemovePhone = async () => {
    try {
      setIsLoading(prev => ({ ...prev, phone: true }));
      setMessage(prev => ({ ...prev, phone: { type: '', text: '' } }));
      
      // Call the server-side API to handle removal
      const response = await fetch('/api/phone/remove-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          phone: phoneVerification.pendingPhone
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Remove phone API error:', errorData);
        throw new Error(errorData.error || 'Failed to remove phone');
      }
      
      // Update local user state and remove from websiteAccount
      if (user) {
        user.phone = null;
        setWebsiteAccount(prev => ({
          ...prev,
          phone: null
        }));
      }
      
      // Reset phone verification state
      setPhoneVerification({
        isPending: false,
        pendingPhone: '',
        otpCode: ''
      });
      
      setMessage(prev => ({
        ...prev,
        phone: { type: 'success', text: 'Phone number removed successfully!' }
      }));
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setMessage(prev => ({
          ...prev,
          phone: { type: '', text: '' }
        }));
      }, 5000);
      
    } catch (error) {
      console.error('Error removing phone:', error);
      setMessage(prev => ({
        ...prev,
        phone: { type: 'error', text: 'Failed to remove phone. Please try again.' }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, phone: false }));
    }
  };

  return (
    <div className={styles.subsection}>
      <h3>Mobile Phone</h3>
      {phoneVerification.isPending && (
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
            color: '#58a6ff'
          }}
        >
          <p><strong>Phone verification pending!</strong></p>
          <p>We've sent a verification code to <strong>{phoneVerification.pendingPhone}</strong></p>
          <p>Please enter the 6-digit code to verify your phone number.</p>
          
          <button 
            onClick={() => setShowOtpModal(true)} 
            className={styles.verifyButton}
            style={{ 
              marginTop: '10px', 
              marginBottom: '10px',
              width: 'auto',
              backgroundColor: '#0366d6',
              color: 'white'
            }}
          >
            Enter Verification Code
          </button>
          
          <button 
            onClick={cancelPhoneVerification} 
            className={styles.cancelButton}
            disabled={isLoading.phone}
          >
            {isLoading.phone ? 'Cancelling...' : 'Cancel Verification'}
          </button>
        </div>
      )}

      {/* Modal for OTP verification */}
      <OtpVerificationModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onVerify={handleVerifyPhoneOtp}
        phoneNumber={phoneVerification.pendingPhone}
        loadingState={isLoading.phone}
        otpValue={phoneVerification.otpCode}
        setOtpValue={value => 
          setPhoneVerification(prev => ({ ...prev, otpCode: value }))
        }
        errorMessage={message.phone.type === 'error' ? message.phone.text : ''}
      />

      <form onSubmit={handlePhoneUpdate} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Phone Number</label>
          <div className={styles.phoneInputWithButton}>
            <div className={`${styles.phoneInputWrapper} ${!isChangingPhone && user?.phone ? styles.readOnlyInput : ''}`} ref={phoneContainerRef}>
              <PhoneInput
                ref={phoneInputRef}
                country={'ma'} // Set Morocco as default
                value={user?.phone ? formatDisplayPhone(user.phone) : ''}
                onChange={(value, country) => {
                  if (!country || !country.dialCode) return;
                  
                  // Get the raw number without the country code
                  let nationalNumber = value.substring(country.dialCode.length);
                  
                  // Remove any leading zeros
                  nationalNumber = nationalNumber.replace(/^0+/, '');
                  
                  // Store in E.164 format with + prefix
                  const e164Number = '+' + country.dialCode + nationalNumber;
                  
                  setWebsiteAccount(prev => ({
                    ...prev,
                    phone: e164Number
                  }));
                }}
                inputProps={{
                  name: 'phone',
                  required: true,
                  placeholder: 'Enter your mobile number',
                  disabled: phoneVerification.isPending || (!isChangingPhone && user?.phone),
                  type: 'tel',
                  className: (!isChangingPhone && user?.phone) ? styles.readOnlyInputField : '',
                  tabIndex: "0",
                }}
                enableSearch
                countryCodeEditable={false}
                disableCountryGuess
                preferredCountries={['ma', 'fr', 'us', 'gb', 'es']} // Morocco, France, USA, UK, Spain
                specialLabel="" // Remove any special label
                
                // Show the country code in the input field
                showCountryCode={true}
                
                // Use inline styles to ensure proper display
                containerStyle={{
                  width: '100%',
                }}
                inputStyle={{
                  width: '100%',
                  height: 'auto',
                  padding: '0.8rem 1rem 0.8rem 3.5rem',
                  background: '#222',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
                dropdownStyle={{
                  backgroundColor: '#222',
                  color: '#fff',
                  border: '1px solid #333',
                  padding: '0',
                }}
                buttonStyle={{ 
                  background: 'transparent', 
                  borderRadius: '8px 0 0 8px',
                  borderColor: 'transparent',
                }}
                searchStyle={{
                  backgroundColor: '#222',
                  color: '#fff',
                  padding: '8px',
                  border: '1px solid #333',
                }}
                
                // Fix tab order issues by setting tabIndex on the button
                buttonProps={{ 
                  tabIndex: -1 // Remove dropdown button from tab order
                }}
                
                searchClass="phone-search-input"
                
                // Set tabIndex globally for all dropdowns
                dropdownClass="phone-dropdown-container"
              />
            </div>
            {!phoneVerification.isPending && (
              <>
                <button
                  type="button"
                  className={styles.changeButton}
                  tabIndex="2"
                  onClick={() => {
                    if (isChangingPhone) {
                      // When cancelling, don't reset the phone field - just exit edit mode
                      setIsChangingPhone(false);
                      setMessage(prev => ({ ...prev, phone: { type: '', text: '' } }));
                    } else {
                      // When starting to change, just open the form
                      setIsChangingPhone(true);
                    }
                  }}
                >
                  {isChangingPhone ? 'Cancel' : (user?.phone ? 'Change' : 'Add')}
                </button>
                
                {/* Add a remove button if the user has a phone number */}
                {user?.phone && !isChangingPhone && (
                  <button
                    type="button"
                    className={`${styles.changeButton} ${styles.removeButton}`}
                    tabIndex="3"
                    onClick={handleRemovePhone}
                  >
                    Remove
                  </button>
                )}
              </>
            )}
          </div>
          <small className={styles.inputHint}>
            {isChangingPhone || !user?.phone 
              ? 'Select your country code and enter your phone number' 
              : 'Your verified phone number'}
          </small>
        </div>
        {isChangingPhone && !phoneVerification.isPending && (
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading.phone || !websiteAccount.phone}
          >
            {isLoading.phone ? 'Sending Code...' : 'Send Verification Code'}
          </button>
        )}
        {message.phone.type && !phoneVerification.isPending && (
          <div className={`${styles.message} ${styles[message.phone.type]}`}>
            {message.phone.text}
          </div>
        )}
      </form>
    </div>
  );
};

export default PhoneSection; 