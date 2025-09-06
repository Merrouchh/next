import { useState, useEffect, useRef } from 'react';
import styles from '../../styles/EditProfile.module.css';
import { FaLock, FaPhoneAlt, FaCheck } from 'react-icons/fa';

const OtpVerificationModal = ({ 
  isOpen, 
  onClose, 
  onVerify, 
  phoneNumber, 
  loadingState, 
  otpValue, 
  setOtpValue, 
  errorMessage 
}) => {
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [individualDigits, setIndividualDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  // Focus the first input when modal opens
  useEffect(() => {
    if (isOpen && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0].focus();
      }, 100);
    }
  }, [isOpen]);

  // Initialize timer
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset timer when modal opens
    setTimer(60);
    setCanResend(false);
    
    // Start countdown
    const countdownInterval = setInterval(() => {
      setTimer(prevTimer => {
        if (prevTimer <= 1) {
          clearInterval(countdownInterval);
          setCanResend(true);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
    
    // Clear timer on modal close
    return () => clearInterval(countdownInterval);
  }, [isOpen]);

  // Convert OTP to individual digits when external value changes
  useEffect(() => {
    if (otpValue) {
      const digits = otpValue.split('');
      const newDigits = [...individualDigits];
      
      digits.forEach((digit, index) => {
        if (index < 6) newDigits[index] = digit;
      });
      
      setIndividualDigits(newDigits);
    }
  }, [otpValue]);

  // Handle digit input
  const handleDigitChange = (index, value) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;
    
    // Update the individual digit
    const newDigits = [...individualDigits];
    newDigits[index] = value.slice(-1); // Only keep the last character if multiple are pasted
    setIndividualDigits(newDigits);
    
    // Update the full OTP value
    setOtpValue(newDigits.join(''));
    
    // Handle auto-focus to next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle key down events for backspace and arrow navigation
  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (individualDigits[index] === '' && index > 0) {
        // If current field is empty and backspace is pressed, go to previous field
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle paste event to distribute digits across inputs
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text/plain').trim();
    
    // Only proceed if the pasted content looks like a valid code
    if (!/^\d+$/.test(pasteData)) return;
    
    const digits = pasteData.split('').slice(0, 6);
    const newDigits = [...individualDigits];
    
    digits.forEach((digit, index) => {
      if (index < 6) newDigits[index] = digit;
    });
    
    setIndividualDigits(newDigits);
    setOtpValue(newDigits.join(''));
    
    // Focus the next empty input or the last one
    const nextEmptyIndex = newDigits.findIndex(d => d === '');
    if (nextEmptyIndex !== -1 && nextEmptyIndex < 6) {
      inputRefs.current[nextEmptyIndex].focus();
    } else if (digits.length < 6) {
      inputRefs.current[digits.length].focus();
    } else {
      inputRefs.current[5].focus();
    }
  };

  // Close modal if Escape key is pressed
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Handle clicks outside the modal to close it
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle conditional rendering based on state
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <FaPhoneAlt size={24} color="#FFD700" style={{ marginBottom: '12px' }} />
          <h2 className={styles.modalTitle}>Phone Verification</h2>
          <p className={styles.modalDescription}>
            Enter the 6-digit code sent to your phone via WhatsApp
          </p>
          <div className={styles.modalPhone}>{phoneNumber}</div>
        </div>
        
        {errorMessage && (
          <div className={`${styles.message} ${styles.error}`}>
            {errorMessage}
          </div>
        )}
        
        <div className={styles.otpInputContainer} onPaste={handlePaste}>
          {individualDigits.map((digit, index) => (
            <input
              key={index}
              ref={el => (inputRefs.current[index] = el)}
              type="text"
              className={styles.otpInput}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              maxLength={1}
              pattern="[0-9]*"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={loadingState}
            />
          ))}
        </div>
        
        <div className={styles.timerText}>
          {canResend ? (
            <button 
              className={styles.resendButton} 
              onClick={() => {
                setTimer(60);
                setCanResend(false);
                // Placeholder for resend functionality
                // handleResendCode();
              }}
              disabled={loadingState}
            >
              Resend Code
            </button>
          ) : (
            <span>Resend code in {timer} seconds</span>
          )}
        </div>
        
        <div className={styles.modalActions}>
          <button 
            className={styles.verifyButton} 
            onClick={() => onVerify(individualDigits.join(''))}
            disabled={individualDigits.join('').length !== 6 || loadingState}
          >
            {loadingState ? 'Verifying...' : 'Verify'}
          </button>
          <button 
            className={styles.modalCancelButton}
            onClick={onClose}
            disabled={loadingState}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default OtpVerificationModal; 