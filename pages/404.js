import React from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Error.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import Head from 'next/head';

const Custom404 = () => {
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <>
      <Head>
        <title>404 - Page Not Found | Merrouch Gaming</title>
        <meta name="description" content="The page you're looking for doesn't exist." />
      </Head>
      
      <ProtectedPageWrapper>
        <div className={styles.errorContainer}>
          <div className={styles.errorContent}>
            <h1 className={styles.errorCode}>404</h1>
            <h2 className={styles.errorTitle}>Page Not Found</h2>
            <p className={styles.errorDescription}>
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <div className={styles.errorActions}>
              <button 
                onClick={handleGoHome}
                className={styles.primaryButton}
              >
                Go Home
              </button>
              <button 
                onClick={handleGoBack}
                className={styles.secondaryButton}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </ProtectedPageWrapper>
    </>
  );
};

export default Custom404; 