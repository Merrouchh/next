import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';
import { getRouteConfig } from '../utils/routeConfig';
import styles from '../styles/ProtectedPageWrapper.module.css';
import Header from './Header';
import DashboardHeader from './DashboardHeader';
import { useMediaQuery } from '../hooks/useMediaQuery';
import LoadingSpinner from './LoadingSpinner';
import { useEffect } from 'react';

const ProtectedPageWrapper = ({ children, progress = 0 }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Get route configuration
  const routeConfig = getRouteConfig(router.pathname);

  // Handle authentication-based routing
  useEffect(() => {
    if (loading) return;

    // Redirect authenticated users from home page to dashboard
    if (user && router.pathname === '/') {
      console.log('User is logged in and on home page, redirecting to dashboard');
      router.replace('/dashboard');
      return;
    }

    // Redirect unauthenticated users from protected routes to home
    if (!user && routeConfig.requireAuth) {
      console.log('User is not logged in, redirecting to home');
      router.replace('/');
    }
  }, [loading, user, router, routeConfig.requireAuth, router.pathname]);

  const showDashboardHeader = user && 
    (!routeConfig.singleHeader || router.pathname === '/' || router.pathname === '/dashboard');
  const isHomePage = router.pathname === '/';
  const hasBottomNav = routeConfig.hasBottomNav;

  // Calculate main content style
  const mainContentStyle = {
    ...(isMobile && user && hasBottomNav && {
      paddingBottom: 'calc(70px + env(safe-area-inset-bottom))',
    })
  };

  // Show loading spinner during authentication check for protected routes
  if (loading && routeConfig.requireAuth) {
    return <LoadingSpinner />;
  }

  // Don't render protected content if user is not authenticated
  if (!user && routeConfig.requireAuth) {
    return null;
  }

  return (
    <div className={styles.wrapper} suppressHydrationWarning>
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
      
      {showDashboardHeader && user && (
        <div className={styles.dashboardWrapper}>
          <DashboardHeader />
        </div>
      )}
      
      <main 
        className={styles.mainContent}
        style={mainContentStyle}
      >
        {children}
      </main>
    </div>
  );
};

export default ProtectedPageWrapper;