import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';
import { getRouteConfig, isAuthPage, requiresAdmin } from '../utils/routeConfig';
import styles from '../styles/ProtectedPageWrapper.module.css';
import Header from './Header';
import DashboardHeader from './DashboardHeader';
import { useMediaQuery } from '../hooks/useMediaQuery';
import LoadingSpinner from './LoadingSpinner';
import { useEffect } from 'react';
import UserSearch from './UserSearch';
import { useModal } from '../contexts/ModalContext';
import { AiOutlineCompass, AiOutlineDesktop, AiOutlineVideoCamera, AiOutlineCalendar } from 'react-icons/ai';
import { toast } from 'react-hot-toast';

const ProtectedPageWrapper = ({ children }) => {
  const { user, loading, initialized } = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isLoginModalOpen, openLoginModal } = useModal();
  const routeConfig = getRouteConfig(router.pathname);
  const isVerificationPage = isAuthPage(router.pathname);
  const isAdminRequired = requiresAdmin(router.pathname);

  const hasNavigation = routeConfig.showNavigation;
  const showDashboardHeader = user && hasNavigation;
  const hasSearchHeader = routeConfig.hasSearchHeader;

  // If this is a verification page, don't wrap with navigation/headers
  if (isVerificationPage) {
    return children;
  }

  // Handle authentication-based routing
  useEffect(() => {
    if (!initialized) return;

    // If user is logged in and on home page, redirect to dashboard
    if (user && router.pathname === '/') {
      console.log('User logged in, redirecting to dashboard');
      router.replace('/dashboard');
      return;
    }
    
    // If user is not logged in and page requires auth, redirect to home
    if (!user && routeConfig.requireAuth) {
      router.replace('/');
      return;
    }
    
    // If admin access is required but user is not an admin, redirect to dashboard
    if (isAdminRequired && user && !user.isAdmin) {
      toast.error('You do not have admin access to this page');
      router.replace('/dashboard');
      return;
    }
  }, [initialized, user, router, routeConfig.requireAuth, router.pathname, isVerificationPage, isAdminRequired]);

  // Show loading spinner during authentication check for protected routes
  if (loading && routeConfig.requireAuth) {
    return <LoadingSpinner />;
  }

  // Don't render protected content if user is not authenticated
  if (!user && routeConfig.requireAuth) {
    return null;
  }
  
  // Don't render admin content if user is not an admin
  if (isAdminRequired && (!user || !user.isAdmin)) {
    return null;
  }

  // If the page requires login but the user isn't logged in, show option to login
  if (routeConfig.requireAuth && !user) {
    return (
      <div className={styles.loginRequired}>
        <h2>Login Required</h2>
        <p>You need to be logged in to view this page.</p>
        <button 
          className={styles.loginButton}
          onClick={() => openLoginModal()}
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} suppressHydrationWarning>
      <div 
        className={styles.contentWrapper}
        data-has-search={hasSearchHeader}
        data-has-dashboard={showDashboardHeader}
        data-is-admin={isAdminRequired}
      >
        <div className={styles.headerWrapper}>
          <Header />
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
          data-is-admin={isAdminRequired}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default ProtectedPageWrapper;