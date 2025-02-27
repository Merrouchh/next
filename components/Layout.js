import Footer from './Footer';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import LoadingScreen from './LoadingScreen';
import React from 'react';
import FAQSchema from './FAQSchema';
import PriceRangeSchema from './PriceRangeSchema';
import styles from '../styles/Layout.module.css';
import LoginModal from './LoginModal';
import { useModal } from '../contexts/ModalContext';

const Layout = ({ children }) => {
  const router = useRouter();
  const { loading: _authLoading, isLoggedIn: _isLoggedIn, initialized } = useAuth();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isHomePage = router.pathname === '/';
  const { isLoginModalOpen, closeLoginModal } = useModal();

  const shouldHideFooter = useCallback(() => {
    if (!router?.pathname) return true;
    
    const hideFooterPaths = [
      '/avcomputers', 
      '/dashboard', 
      '/shop', 
      '/upload',
      '/discover',
      '/topusers'
    ];
    
    const isProfilePage = router.pathname.startsWith('/profile/');
    return hideFooterPaths.includes(router.pathname) || isProfilePage;
  }, [router?.pathname]);

  // Initialize component
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle route changes
  useEffect(() => {
    if (!mounted) return;

    const handleStart = () => setIsTransitioning(true);
    const handleComplete = () => setIsTransitioning(false);
    const handleError = () => setIsTransitioning(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
    };
  }, [router.events, mounted]);

  if (!mounted || !initialized) {
    return (
      <>
        <div className={styles.layoutWrapper}>
          <div className={styles.loadingContainer}>
            <LoadingScreen type="auth" />
          </div>
        </div>
        <div id="modal-root" className={styles.modalRoot}></div>
      </>
    );
  }

  return (
    <>
      <div className={styles.layoutWrapper}>
        <div className={styles.layoutContent}>
          <main className={styles.mainContent}>
            {isHomePage && (
              <>
                <FAQSchema />
                <PriceRangeSchema />
              </>
            )}
            {children}
          </main>
          {!shouldHideFooter() && <Footer />}
        </div>
      </div>
      <div id="modal-root" className={styles.modalRoot}>
        <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      </div>
    </>
  );
};

export default Layout;
