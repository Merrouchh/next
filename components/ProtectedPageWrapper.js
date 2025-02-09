import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';
import { getRouteConfig } from '../utils/routeConfig';
import styles from '../styles/ProtectedPageWrapper.module.css';
import Header from './Header';
import DashboardHeader from './DashboardHeader';

const ProtectedPageWrapper = ({ children, progress = 0 }) => {
  const { isLoggedIn, loading: authLoading, userData, logout, supabase } = useAuth();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Get route configuration
  const routeConfig = getRouteConfig(router.pathname);
  // Update showDashboardHeader logic to handle root path
  const showDashboardHeader = isLoggedIn && 
    (!routeConfig.singleHeader || router.pathname === '/' || router.pathname === '/dashboard');

  // Check if we're on the home page
  const isHomePage = router.pathname === '/';

  // Navigation handling
  useEffect(() => {
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
  }, [router]);

  // Auth check
  useEffect(() => {
    if (routeConfig.requireAuth && !authLoading && !isLoggedIn) {
      router.replace('/');
    }
  }, [isLoggedIn, authLoading, router, routeConfig]);

  // Add session validation check
  useEffect(() => {
    const validateSession = async () => {
      if (isLoggedIn) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error || !session) {
            // Force logout if session is invalid
            logout();
          }
        } catch (error) {
          console.error('Session validation error:', error);
        }
      }
    };

    validateSession();
  }, [isLoggedIn, supabase, logout]);

  if (isNavigating) {
    return <LoadingScreen message="Navigating..." type="auth" />;
  }

  return (
    <>
      <div className={styles.headerSection}>
        <Header />
        {isHomePage && (
          <div className={styles.progressBarContainer}>
            <div 
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {showDashboardHeader && userData && <DashboardHeader />}
      </div>
      
      <div className={styles.wrapper}>
        <main className={styles.mainContent}>
          {authLoading && routeConfig.requireAuth ? (
            <div className={styles.contentLoading}>
              <LoadingScreen message="Loading..." type="content" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </>
  );
}

export default ProtectedPageWrapper;