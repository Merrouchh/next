import Footer from './Footer';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import LoadingScreen from './LoadingScreen';
import { VideoProvider } from '../context/VideoContext';
import React from 'react';
import BusinessInfo from './BusinessInfo';
import FAQSchema from './FAQSchema';

const Layout = ({ children }) => {
  const router = useRouter();
  const { loading: _authLoading, isLoggedIn: _isLoggedIn, initialized } = useAuth();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);

  const shouldHideFooter = useCallback(() => {
    if (!router?.pathname) return true;
    
    const hideFooterPaths = [
      '/avcomputers', 
      '/dashboard', 
      '/shop', 
      '/upload', 
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

  // Only show loading during initial mount
  if (!mounted || !initialized) {
    return <LoadingScreen />;
  }

  return (
    <VideoProvider>
      <div className={`layout ${isTransitioning ? 'transitioning' : ''}`}>
        <main className="main-content">
          <BusinessInfo />
          <FAQSchema />
          {children}
        </main>
        {!shouldHideFooter() && <Footer />}
      </div>
      <div id="modal-root"></div>
    </VideoProvider>
  );
};

export default Layout;
