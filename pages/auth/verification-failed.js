import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/Auth.module.css';
import Link from 'next/link';

export default function VerificationFailed() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);
  const [errorInfo, setErrorInfo] = useState({
    code: '',
    description: ''
  });

  // Log for debugging
  useEffect(() => {
    console.log('Verification Failed Page Loaded', { 
      pathname: router.pathname,
      query: router.query
    });
    
    // Extract error info from query parameters
    if (router.isReady) {
      const { error_code, error_description } = router.query;
      
      setErrorInfo({
        code: error_code || 'unknown_error',
        description: error_description || 'The verification link is invalid or has expired.'
      });
    }
  }, [router, router.isReady]);

  useEffect(() => {
    // Redirect to the home page after 10 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  // Function to get a user-friendly error message
  const getErrorMessage = () => {
    const errorCode = errorInfo.code.toLowerCase();
    
    if (errorCode.includes('expired') || errorCode === 'otp_expired') {
      return 'The verification link has expired. Please request a new verification email.';
    }
    
    if (errorCode.includes('invalid')) {
      return 'The verification link is invalid.';
    }
    
    if (errorInfo.description) {
      // Clean up the description - sometimes they come with URL encodings
      return errorInfo.description
        .replace(/\+/g, ' ')
        .replace(/%[0-9A-F]{2}/g, ' ');
    }
    
    return 'We couldn\'t verify your email address.';
  };

  return (
    <>
      <Head>
        <title>Verification Failed - Merrouch Gaming</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1>Verification Failed</h1>
          </div>
          <div className={styles.cardBody}>
            <div className={`${styles.successIcon} ${styles.errorIcon}`}>✗</div>
            
            <p className={styles.message}>
              {getErrorMessage()}
            </p>
            
            <div className={styles.errorDetail}>
              {errorInfo.code && (
                <p className={styles.errorCode}>Error code: {errorInfo.code}</p>
              )}
            </div>
            
            <p className={styles.message}>
              This may be because:
            </p>
            
            <ul className={styles.errorList}>
              <li>The verification link has expired</li>
              <li>The verification link has already been used</li>
              <li>There was a technical issue with your account</li>
            </ul>
            
            <p className={styles.redirectText}>
              You will be redirected to the home page in {countdown} seconds...
            </p>
            
            <div className={styles.actions}>
              <Link href="/editprofile">
                <span className={styles.button}>Go to profile</span>
              </Link>
              <Link href="/">
                <span className={`${styles.button} ${styles.secondaryButton}`}>Go to home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 