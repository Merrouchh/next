import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/AdminPageWrapper.module.css';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { FaUsers, FaDesktop, FaCalendarAlt, FaTachometerAlt, FaChevronLeft, FaChartLine, FaBell, FaClock, FaTrophy } from 'react-icons/fa';

/**
 * Wrapper component for admin-only pages
 * Provides consistent layout and navigation for admin pages
 * Checks if the user is an admin and redirects to dashboard if not
 */
export default function AdminPageWrapper({ children, title }) {
  const { user, isLoggedIn, loading, initialized } = useAuth();
  const router = useRouter();
  const currentPath = router.pathname;
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Function to log unauthorized access attempts from client-side
  const logUnauthorizedAccess = useCallback(async (type, user, path) => {
    console.log('🚨 SECURITY: Logging unauthorized access attempt:', {
      type,
      username: user?.username || 'anonymous',
      path,
      userInfo: { isAdmin: user?.isAdmin, isStaff: user?.isStaff, isLoggedIn }
    });
    
    try {
      const response = await fetch('/api/security/log-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: type === 'admin_access' ? 'unauthorized_admin_access' : 'unauthorized_staff_access',
          username: user?.username || 'anonymous',
          attempted_path: path,
          details: type === 'admin_access' 
            ? 'User without admin/staff privileges attempted to access admin page'
            : 'Staff user attempted to access admin-only page',
          severity: 'high'
        })
      });
      
      const result = await response.json();
      console.log('🚨 SECURITY: Logging result:', result);
    } catch (error) {
      console.error('🚨 SECURITY: Failed to log security event:', error);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    // Only redirect if auth is fully initialized
    if (initialized && !loading) {
      if (!isLoggedIn || (!user?.isAdmin && !user?.isStaff)) {
        // 🚨 Log unauthorized access attempt
        logUnauthorizedAccess('admin_access', user, currentPath);
        
        toast.error('You do not have permission to access admin pages');
        router.replace('/dashboard');
        return;
      }
      
      // Staff users can ONLY access queue page - block access to all other admin pages
      if (user?.isStaff && !user?.isAdmin && !currentPath.includes('/admin/queue')) {
        // 🚨 Log staff attempting to access admin-only page
        logUnauthorizedAccess('staff_admin_access', user, currentPath);
        
        toast.error('Staff access is limited to queue management only');
        router.replace('/admin/queue');
        return;
      }
    }
  }, [user, isLoggedIn, loading, initialized, router, currentPath, logUnauthorizedAccess]);


  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialized && !loading) {
        setLoadingTimeout(true);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timer);
  }, [initialized, loading]);

  // If loading has timed out, try to force a page refresh
  if (loadingTimeout) {
    return (
      <div className={styles.adminLoading}>
        Authentication timeout. 
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            marginTop: '1rem', 
            padding: '0.5rem 1rem', 
            background: '#FFD700', 
            color: '#000', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Page
        </button>
      </div>
    );
  }

  // Show loading while authentication is not yet initialized or still loading
  if (!initialized || loading) {
    return <div className={styles.adminLoading}>Checking admin access...</div>;
  }

  // Show loading if user is not logged in or not admin/staff (but auth is initialized)
  if (!isLoggedIn || (!user?.isAdmin && !user?.isStaff)) {
    return <div className={styles.adminLoading}>Checking admin access...</div>;
  }

  // Staff users can ONLY access queue page - block access to all other admin pages
  if (user?.isStaff && !user?.isAdmin && !currentPath.includes('/admin/queue')) {
    return <div className={styles.adminLoading}>Redirecting to queue management...</div>;
  }

  // Admin menu items - filter based on user role
  const baseAdminMenu = [
    { path: '/admin', label: 'Dashboard', icon: <FaTachometerAlt />, adminOnly: false },
    { path: '/admin/users', label: 'Users', icon: <FaUsers />, adminOnly: true },
    { path: '/admin/events', label: 'Events', icon: <FaCalendarAlt />, adminOnly: true },
    { path: '/admin/events/brackets', label: 'Brackets', icon: <FaTrophy />, adminOnly: true },
    { path: '/admin/sessions', label: 'Sessions', icon: <FaDesktop />, adminOnly: true },
    { path: '/admin/queue', label: 'Queue', icon: <FaUsers />, adminOnly: false },
    { path: '/admin/stats', label: 'Analytics', icon: <FaChartLine />, adminOnly: true },
    { path: '/admin/tasks', label: 'Tasks', icon: <FaClock />, adminOnly: true },
    { path: '/admin/notifications', label: 'Notifications', icon: <FaBell />, adminOnly: true },
  ];

  // Filter menu items based on user role
  const adminMenu = baseAdminMenu.filter(item => {
    if (user?.isAdmin) return true; // Admins see everything
    if (user?.isStaff) return !item.adminOnly; // Staff only see non-admin-only items
    return false;
  });

  // Check if path is active (exact match or active section)
  const isActivePath = (path) => {
    if (path === '/admin') {
      return currentPath === '/admin';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className={styles.adminWrapper}>
      <div className={styles.adminSidebar}>
        <div className={styles.adminLogo}>
          <h2 className={styles.adminLogoText}>Admin Panel</h2>
          <div className={styles.adminLogoGlow}></div>
        </div>
        
        <nav className={styles.adminNav}>
          <ul>
            {adminMenu.map((item) => (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`${styles.adminNavLink} ${isActivePath(item.path) ? styles.active : ''}`}
                >
                  <span className={styles.adminNavIcon}>{item.icon}</span>
                  <span className={styles.adminNavLabel}>{item.label}</span>
                  {isActivePath(item.path) && <span className={styles.activeIndicator}></span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className={styles.adminBackLink}>
          <Link href="/dashboard" className={styles.backToDashboard}>
            <FaChevronLeft /> Back to Dashboard
          </Link>
        </div>
      </div>
      
      <div className={styles.adminContent}>
        <header className={styles.adminHeader}>
          <h1 className={styles.adminTitle}>{title || 'Admin Panel'}</h1>
          <div className={styles.adminUser}>
            {user?.username || user?.email} 
            <span className={styles.adminBadge}>
              {user?.isAdmin ? 'Admin' : 'Staff'}
            </span>
          </div>
        </header>
        
        <main className={styles.adminMain}>
          {children}
        </main>
      </div>
    </div>
  );
} 