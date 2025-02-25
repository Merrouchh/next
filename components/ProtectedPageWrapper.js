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
import UserSearch from './UserSearch';
import { useModal } from '../contexts/ModalContext';
import { AiOutlineCompass, AiOutlineDesktop, AiOutlineVideoCamera } from 'react-icons/ai';

const ProtectedPageWrapper = ({ children, progress = 0 }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isLoginModalOpen } = useModal();
  const routeConfig = getRouteConfig(router.pathname);

  // Get route configuration
  const hasNavigation = routeConfig.showNavigation;

  // Calculate main content style
  const mainContentStyle = {
    ...(isMobile && hasNavigation && {
      paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))'
    })
  };

  // Handle authentication-based routing
  useEffect(() => {
    if (loading) return;

    // Redirect authenticated users from home page to dashboard
    if (user && router.pathname === '/') {
      router.replace('/dashboard');
      return;
    }

    // Redirect unauthenticated users from protected routes to home
    if (!user && routeConfig.requireAuth) {
      router.replace('/');
    }
  }, [loading, user, router, routeConfig.requireAuth, router.pathname]);

  const showDashboardHeader = user && hasNavigation;
  const showUserSearch = routeConfig.showSearch || (router.pathname === '/' && !user);

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
      <div className={styles.contentWrapper}>
        <div className={styles.headerWrapper}>
          <Header />
          {router.pathname === '/' && (
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBar}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        
        {showDashboardHeader && (
          <div className={styles.dashboardWrapper}>
            <DashboardHeader />
          </div>
        )}

        {showUserSearch && (
          <div className={`
            ${styles.userSearchWrapper} 
            ${showDashboardHeader ? styles.withDashboardHeader : ''}
          `}>
            <UserSearch />
          </div>
        )}
        
        <main 
          className={`${styles.mainContent} ${hasNavigation ? styles.hasBottomNav : ''} ${showUserSearch ? styles.withSearch : ''}`}
          style={mainContentStyle}
        >
          {children}
        </main>

        {/* Bottom Navigation - Only show when user is logged in */}
        {isMobile && user && hasNavigation && (
          <div className={styles.bottomNav}>
            <button
              onClick={() => router.push('/discover')}
              className={`${styles.navButton} ${router.pathname === '/discover' ? styles.active : ''}`}
            >
              <span className={styles.icon}><AiOutlineCompass size={20} /></span>
              <span className={styles.label}>Discover</span>
            </button>
            <button
              onClick={() => router.push('/avcomputers')}
              className={`${styles.navButton} ${router.pathname === '/avcomputers' ? styles.active : ''}`}
            >
              <span className={styles.icon}><AiOutlineDesktop size={20} /></span>
              <span className={styles.label}>Computers</span>
            </button>
            <button
              onClick={() => router.push(`/profile/${user?.username}`)}
              className={`${styles.navButton} ${router.pathname.startsWith('/profile/') ? styles.active : ''}`}
            >
              <span className={styles.icon}><AiOutlineVideoCamera size={20} /></span>
              <span className={styles.label}>Profile</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProtectedPageWrapper;