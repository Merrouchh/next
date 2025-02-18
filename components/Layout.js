import Footer from './Footer';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import LoadingScreen from './LoadingScreen';
import React from 'react';
import FAQSchema from './FAQSchema';
import PriceRangeSchema from './PriceRangeSchema';
import styles from '../styles/Layout.module.css';

const Layout = ({ children }) => {
  const router = useRouter();
  const { loading: _authLoading, isLoggedIn: _isLoggedIn, initialized } = useAuth();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isHomePage = router.pathname === '/';

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

  // Return consistent loading screen structure
  if (!mounted || !initialized) {
    return (
      <div className={styles.layoutWrapper}>
        <div className={styles.loadingContainer} suppressHydrationWarning>
          <LoadingScreen type="auth" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layoutWrapper}>
      <div className={`${styles.layoutContent} ${isTransitioning ? styles.transitioning : ''}`}>
        <main className={styles.mainContent}>
          {/* Include schemas only on homepage */}
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
      <div id="modal-root"></div>
    </div>
  );
};

export default Layout;
