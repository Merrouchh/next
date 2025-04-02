import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Head from 'next/head';
import styles from '../../styles/Auth.module.css';
import Link from 'next/link';

export default function VerificationSuccess() {
  const router = useRouter();
  const { type, email } = router.query;
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(5);
  const [verifiedEmail, setVerifiedEmail] = useState(email || '');
  const [verificationType, setVerificationType] = useState(type || '');

  // If we don't have an email in the query but we have a logged-in user,
  // use their email for display
  useEffect(() => {
    if (!email && user?.email) {
      setVerifiedEmail(user.email);
    } else if (email) {
      setVerifiedEmail(email);
    }

    // Set a default type if none is provided
    if (!type && window.location.href.includes('email')) {
      setVerificationType('email_change');
    } else if (!type) {
      setVerificationType('signup');
    }
  }, [email, user, type]);

  useEffect(() => {
    // Redirect to the profile page after 5 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(verificationType === 'email_change' ? '/editprofile' : '/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, verificationType]);

  // Get the appropriate message
  const getMessage = () => {
    if (verificationType === 'email_change' && verifiedEmail) {
      return `Your email address has been successfully changed to ${verifiedEmail}.`;
    } else if (verificationType === 'email_change') {
      return 'Your email address has been successfully changed.';
    } else if (verificationType === 'signup') {
      return 'Your account has been successfully verified.';
    } else if (verificationType === 'recovery') {
      return 'Your password has been successfully reset.';
    } else {
      return 'Email confirmed!';
    }
  };

  return (
    <>
      <Head>
        <title>Verification Successful - Merrouch Gaming</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1>Success!</h1>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.successIcon}>✓</div>
            
            <p className={styles.message}>
              {getMessage()}
            </p>
            
            <p className={styles.redirectText}>
              You will be redirected to {verificationType === 'email_change' ? 'your profile' : 'the dashboard'} in {countdown} seconds...
            </p>
            
            <div className={styles.actions}>
              <Link href={verificationType === 'email_change' ? '/editprofile' : '/dashboard'}>
                <span className={styles.button}>
                  Go to {verificationType === 'email_change' ? 'profile' : 'dashboard'} now
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 