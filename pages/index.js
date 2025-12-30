import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import Head from 'next/head';

// Components
import LoginModal from '../components/LoginModal';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
// DynamicMeta removed - metadata now handled in _document.js
import HeroSection from '../components/HeroSection';
import SEOContentSection from '../components/SEOContentSection';

// DarkModeMap removed for performance - replaced with static location card

// Main Home component first
const Home = () => {
  const { user, loading, supabase, initialized } = useAuth();
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [processingMagicLink, setProcessingMagicLink] = useState(false);
  const [initTimeout, setInitTimeout] = useState(false);
  const [shouldShowPage, setShouldShowPage] = useState(false);

  // Enhanced timeout for auth initialization with better fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialized) {
        console.warn('Auth initialization timeout, showing page anyway');
        setInitTimeout(true);
        setShouldShowPage(true);
      }
    }, 3000);

    // Also show page when properly initialized
    if (initialized) {
      setShouldShowPage(true);
    }

    return () => clearTimeout(timer);
  }, [initialized]);

  // Debug logging for white screen issue
  useEffect(() => {
    console.log('Home page state:', {
      initialized,
      loading,
      user: user ? 'logged in' : 'not logged in',
      isVerifying,
      initTimeout,
      pathname: router.pathname
    });
  }, [initialized, loading, user, isVerifying, initTimeout, router.pathname]);

  // Enhanced magic link detection with better error handling
  useEffect(() => {
    // Skip if not in browser or if already processing
    if (typeof window === 'undefined' || processingMagicLink) return;
    
    const detectMagicLink = async () => {
      try {
        const hash = window.location.hash;
        // Check if this looks like a magic link hash fragment
        if (hash && 
            hash.includes('access_token=') && 
            hash.includes('refresh_token=') &&
            hash.includes('type=magiclink')) {
          
          console.log('Detected magic link hash on homepage');
          setProcessingMagicLink(true);
          setIsVerifying(true);
          
          // Parse the hash parameters
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (!accessToken || !refreshToken) {
            throw new Error('Invalid magic link parameters');
          }
          
          // Set the session with tokens
          console.log('Setting session with magic link tokens');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            throw error;
          }
          
          // Clear hash immediately
          window.history.replaceState(null, '', window.location.pathname);
          
          // Redirect to dashboard with a slight delay
          console.log('Magic link auth successful, redirecting to dashboard');
          setTimeout(() => {
            router.replace('/dashboard');
          }, 500);
          
        }
      } catch (error) {
        console.error('Error processing magic link:', error);
        setIsVerifying(false);
        setProcessingMagicLink(false);
        setShouldShowPage(true); // Show page on error
      }
    };
    
    // Only run if supabase is available
    if (supabase) {
      detectMagicLink();
    }
  }, [supabase, router, processingMagicLink]);

  // Function to check if URL has auth tokens
  const hasAuthTokens = () => {
    if (typeof window === 'undefined') return false;
    
    const urlParams = new URLSearchParams(window.location.search);
    const hasToken = urlParams.has('token') || urlParams.has('token_hash');
    const hasCode = urlParams.has('code');
    
    return hasToken || hasCode || 
           window.location.hash.includes('access_token') || 
           window.location.hash.includes('type=');
  };

  // Check for verification_pending and auth_action URL parameters
  useEffect(() => {
    if (router.isReady && !user && router.query) {
      // Safely destructure query parameters
      const auth_action = router.query.auth_action;
      const verification_pending = router.query.verification_pending;
      
      if (auth_action === 'login' || verification_pending === 'true') {
        // Show login modal if requested in URL
        setIsLoginModalOpen(true);
        
        // Show a special message if verification is pending
        if (verification_pending === 'true') {
          // Can use a toast or some other notification here if desired
          console.log('Please log in to complete your email verification');
        }
        
        // Create a new query object without these parameters
        const newQuery = { ...router.query };
        delete newQuery.auth_action;
        delete newQuery.verification_pending;
        
        // Clear the query parameters after processing
        router.replace({
          pathname: router.pathname,
          query: newQuery
        }, undefined, { shallow: true });
      }
    }
  }, [router.isReady, router.query, user, router]);

  // Handle dashboard redirect for logged-in users - with safety checks
  useEffect(() => {
    // Only redirect if everything is properly initialized and ready
    if (!loading && !isVerifying && user && router.isReady && initialized && !processingMagicLink) {
      if (!hasAuthTokens()) {
        console.log('User is logged in and no auth tokens in URL, redirecting to dashboard');
        // Add a small delay to prevent race conditions
        setTimeout(() => {
          router.replace('/dashboard');
        }, 100);
      }
    }
  }, [user, loading, router.isReady, isVerifying, initialized, processingMagicLink, router]);



  // Enhanced loading states with better conditions
  if (isVerifying) {
    return <div className={styles.simpleLoadingWrapper}>
      {processingMagicLink ? "Processing magic link login..." : "Verifying email..."}
    </div>;
  }
  
  // Show redirecting message only for confirmed logged-in users who should be redirected
  if (user && !hasAuthTokens() && !loading && initialized) {
    return <div className={styles.simpleLoadingWrapper}>Redirecting to dashboard...</div>;
  }
  
  // Show loading if auth is not ready yet (prevent white screen)
  if (!shouldShowPage && !initTimeout) {
    return <div className={styles.simpleLoadingWrapper}>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>PC Gaming Center Tangier | RTX 3070 Gaming PCs Morocco</title>
        <meta name="description" content="Premium PC gaming center in Tangier with RTX 3070 PCs, Ryzen 7 7700, 240Hz monitors & 200Mbps internet. Competitive gaming café in Morocco." />
      </Head>

      <ProtectedPageWrapper>
        <HeroSection 
          router={router}
        />

        {/* SEO Content Section with H2-H6 Header Tags */}
        <SEOContentSection />

        {/* Modals */}
        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
        />
      </ProtectedPageWrapper>
    </>
  );
};

export default Home;

export async function getServerSideProps() {
  return {
    props: {}
  };
}
