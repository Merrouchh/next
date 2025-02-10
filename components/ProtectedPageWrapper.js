import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';
import { getRouteConfig } from '../utils/routeConfig';
import styles from '../styles/ProtectedPageWrapper.module.css';
import Header from './Header';
import DashboardHeader from './DashboardHeader';
import { useMediaQuery } from '../hooks/useMediaQuery';

const ProtectedPageWrapper = ({ children, progress = 0 }) => {
  const { isLoggedIn, loading: authLoading, userData, logout, supabase } = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isNavigating, setIsNavigating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get route configuration
  const routeConfig = getRouteConfig(router.pathname);
  const showDashboardHeader = isLoggedIn && 
    (!routeConfig.singleHeader || router.pathname === '/' || router.pathname === '/dashboard');
  const isHomePage = router.pathname === '/';
  const hasBottomNav = routeConfig.hasBottomNav;

  // Calculate main content style
  const mainContentStyle = {
    ...(isMobile && isLoggedIn && hasBottomNav && {
      paddingBottom: 'calc(70px + env(safe-area-inset-bottom))', // Adjust this value based on your bottom nav height
    })
  };

  // Navigation handling
  useEffect(() => {
    if (!mounted) return;

    const handleStart = () => setIsNavigating(true);
    const handleComplete = () => setIsNavigating(false);
    const handleError = () => setIsNavigating(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
    };
  }, [router, mounted]);

  // Auth check
  useEffect(() => {
    if (!mounted) return;

    console.log('Route Config:', {
      path: router.pathname,
      config: routeConfig,
      authLoading,
      isLoggedIn
    });

    if (!authLoading && !isLoggedIn && routeConfig.requireAuth && !routeConfig.public) {
      console.log('Redirecting because:', {
        authLoading,
        isLoggedIn,
        requireAuth: routeConfig.requireAuth,
        public: routeConfig.public
      });
      router.replace('/');
    }
  }, [authLoading, isLoggedIn, router, routeConfig]);

  // Add session validation check
  useEffect(() => {
    if (!mounted) return;

    const validateSession = async () => {
      if (isLoggedIn) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error || !session) {
            logout();
          }
        } catch (error) {
          console.error('Session validation error:', error);
        }
      }
    };

    validateSession();
  }, [isLoggedIn, supabase, logout, mounted]);

  const renderLoading = () => (
    <div className={styles.navigationLoadingWrapper} suppressHydrationWarning>
      <LoadingScreen message="Navigating..." type="content" />
    </div>
  );

  if (!mounted) {
    return renderLoading();
  }

  if (isNavigating) {
    return renderLoading();
  }

  return (
    <div className={styles.wrapper} suppressHydrationWarning>
      {/* Create a separate container for headers with higher z-index */}
      <div className={styles.headerWrapper}>
        <Header />
        {isHomePage && (
          <div className={styles.progressBarContainer}>
            <div 
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Separate container for DashboardHeader */}
      {showDashboardHeader && userData && (
        <div className={styles.dashboardWrapper}>
          <DashboardHeader />
        </div>
      )}
      
      <main 
        className={styles.mainContent}
        style={mainContentStyle}
      >
        {authLoading && routeConfig.requireAuth ? (
          <div className={styles.contentLoading}>
            <LoadingScreen message="Loading..." type="content" />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
};

export default ProtectedPageWrapper;