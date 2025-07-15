import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { getRouteConfig, isAuthPage, requiresAdmin } from '../utils/routeConfig';
import styles from '../styles/ProtectedPageWrapper.module.css';
import Header from './Header';
import MobileHeader from './MobileHeader';
import DashboardHeader from './DashboardHeader';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useEffect } from 'react';
import UserSearch from './UserSearch';
import { useModal } from '../contexts/ModalContext';
import { toast } from 'react-hot-toast';
import userSearchStyles from '../styles/UserSearch.module.css';

const ProtectedPageWrapper = ({ children }) => {
  const { user, initialized } = useAuth();
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
    // Don't do anything if auth is not initialized yet
    if (!initialized) return;

    // If user is logged in and on home page, redirect to dashboard
    // But only if we're not already in the middle of a redirect
    if (user && router.pathname === '/' && router.isReady) {
      console.log('User logged in, redirecting to dashboard');
      router.replace('/dashboard');
      return;
    }
    
    // If user is not logged in and page requires auth, redirect to home
    if (!user && routeConfig.requireAuth && router.isReady) {
      router.replace('/');
      return;
    }
    
    // If admin access is required but user is not an admin, redirect to dashboard
    if (isAdminRequired && user && !user.isAdmin && router.isReady) {
      toast.error('You do not have admin access to this page');
      router.replace('/dashboard');
      return;
    }
  }, [initialized, user, router, routeConfig.requireAuth, router.pathname, router.isReady, isVerificationPage, isAdminRequired]);

  // Show loading while auth is initializing (except for home page which handles its own loading)
  if (!initialized && router.pathname !== '/') {
    return <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      fontSize: '1.2rem', 
      color: '#FFD700' 
    }}>Loading...</div>;
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
      {/* Fixed header section */}
      <div className={styles.fixedHeadersContainer}>
        {/* Header - uses static rendering approach to prevent flashing */}
        <div className={styles.fixedHeader} style={{ zIndex: 'var(--header-z-index)' }}>
          {isMobile ? <MobileHeader /> : <Header />}
        </div>
        
        {/* Dashboard navigation (if needed) */}
        {showDashboardHeader && (
          <div className={styles.fixedHeader} style={{ 
            top: 'var(--header-height)', 
            zIndex: 'var(--dashboard-header-z-index)' 
          }}>
            <DashboardHeader />
          </div>
        )}
        
        {/* User search navigation (if needed) */}
        {hasSearchHeader && (
          <div className={styles.fixedHeader} style={{ 
            top: showDashboardHeader 
              ? 'calc(var(--header-height) + var(--dashboard-header-height))' 
              : 'var(--header-height)',
            zIndex: 'var(--search-header-z-index)'
          }}>
            <UserSearch 
              className={showDashboardHeader ? userSearchStyles.withDashboardHeader : ''}
            />
          </div>
        )}
      </div>
      
      <div 
        className={styles.contentWrapper}
        data-has-search={hasSearchHeader}
        data-has-dashboard={showDashboardHeader}
        data-is-admin={isAdminRequired}
      >
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