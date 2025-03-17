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
import { AiOutlineCompass, AiOutlineDesktop, AiOutlineVideoCamera, AiOutlineCalendar } from 'react-icons/ai';

const ProtectedPageWrapper = ({ children, progress = 0 }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isLoginModalOpen } = useModal();
  const routeConfig = getRouteConfig(router.pathname);

  const hasNavigation = routeConfig.showNavigation;
  const showDashboardHeader = user && hasNavigation;
  const hasSearchHeader = routeConfig.hasSearchHeader;

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
      </div>
    </div>
  );
};

export default ProtectedPageWrapper;