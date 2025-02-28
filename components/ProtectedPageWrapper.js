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

  // Add console.log to debug
  console.log('Current path:', router.pathname);
  console.log('Route config:', routeConfig);
  console.log('Has search header:', routeConfig.hasSearchHeader);

  const hasNavigation = routeConfig.showNavigation;
  const showDashboardHeader = user && hasNavigation;
  const hasSearchHeader = routeConfig.hasSearchHeader;

  // Calculate main content style
  const mainContentStyle = {
    ...(isMobile && hasNavigation && {
      paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))'
    })
  };

  // Handle authentication-based routing
  useEffect(() => {
    if (loading) return;
    if (user && router.pathname === '/') {
      router.replace('/dashboard');
      return;
    }
    if (!user && routeConfig.requireAuth) {
      router.replace('/');
    }
  }, [loading, user, router, routeConfig.requireAuth, router.pathname]);

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
      <div 
        className={styles.contentWrapper}
        data-has-search={hasSearchHeader}
        data-has-dashboard={showDashboardHeader}
      >
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

        {/* Add console.log to debug */}
        {console.log('Should show search header:', hasSearchHeader)}
        {hasSearchHeader && (
          <div className={`${styles.userSearchWrapper} ${showDashboardHeader ? styles.withDashboard : ''}`}>
            <UserSearch />
          </div>
        )}
        
        <main 
          className={styles.mainContent}
          data-has-nav={hasNavigation}
        >
          {children}
        </main>

        {isMobile && user && hasNavigation && (
          <nav className={styles.bottomNav}>
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
          </nav>
        )}
      </div>
    </div>
  );
};

export default ProtectedPageWrapper;