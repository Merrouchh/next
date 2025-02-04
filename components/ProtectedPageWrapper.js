import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';
import { getRouteConfig } from '../utils/routeConfig';
import styles from '../styles/ProtectedPageWrapper.module.css';
import Header from './Header';
import DashboardHeader from './DashboardHeader';
import monitoring from '../utils/monitoring';

const ProtectedPageWrapper = ({ children }) => {
  const { isLoggedIn, loading: authLoading, userData } = useAuth();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Get route configuration
  const routeConfig = getRouteConfig(router.pathname);
  const showDashboardHeader = isLoggedIn && !routeConfig.singleHeader;

  // Navigation handling
  useEffect(() => {
    const handleStart = () => setIsNavigating(true);
    const handleComplete = () => {
      setIsNavigating(false);
    };
    const handleError = () => setIsNavigating(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    // Proper cleanup
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

  useEffect(() => {
    const pagePath = window.location.pathname;
    monitoring.logPageView(pagePath, userData?.id);
  }, [userData]);

  // Only show full-page loading when actually navigating between pages
  if (isNavigating) {
    return <LoadingScreen message="Navigating..." type="auth" />;
  }

  const authState = isLoggedIn ? 'loggedIn' : 'loggedOut';

  return (
    <div 
      className={`${styles.wrapper} ${showDashboardHeader ? styles.doubleHeaderPadding : styles.singleHeaderPadding}`}
      style={{
        '--mobile-padding': routeConfig.mobileTopPadding[authState],
        '--tablet-padding': routeConfig.tabletTopPadding[authState],
        '--desktop-padding': routeConfig.desktopTopPadding[authState],
      }}
    >
      <Header />
      {showDashboardHeader && userData && <DashboardHeader />}
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
  );
}

export default ProtectedPageWrapper;