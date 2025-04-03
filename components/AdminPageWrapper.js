import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';
import styles from '../styles/AdminPageWrapper.module.css';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { FaUsers, FaDesktop, FaCalendarAlt, FaTachometerAlt, FaChevronLeft } from 'react-icons/fa';

/**
 * Wrapper component for admin-only pages
 * Provides consistent layout and navigation for admin pages
 * Checks if the user is an admin and redirects to dashboard if not
 */
export default function AdminPageWrapper({ children, title }) {
  const { user, isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const currentPath = router.pathname;

  useEffect(() => {
    // If authentication is complete and user is not an admin, redirect to dashboard
    if (!loading && (!isLoggedIn || !user?.isAdmin)) {
      toast.error('You do not have permission to access admin pages');
      router.replace('/dashboard');
    }
  }, [user, isLoggedIn, loading, router]);

  // Show loading screen while checking authentication
  if (loading || !isLoggedIn || !user?.isAdmin) {
    return <LoadingScreen message="Checking admin access..." />;
  }

  // Admin menu items
  const adminMenu = [
    { path: '/admin', label: 'Dashboard', icon: <FaTachometerAlt /> },
    { path: '/admin/users', label: 'Users', icon: <FaUsers /> },
    { path: '/admin/events', label: 'Events', icon: <FaCalendarAlt /> },
    { path: '/admin/sessions', label: 'Sessions', icon: <FaDesktop /> },
  ];

  return (
    <div className={styles.adminWrapper}>
      <div className={styles.adminSidebar}>
        <div className={styles.adminLogo}>
          <h2>Admin Panel</h2>
        </div>
        
        <nav className={styles.adminNav}>
          <ul>
            {adminMenu.map((item) => (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`${styles.adminNavLink} ${currentPath === item.path ? styles.active : ''}`}
                >
                  <span className={styles.adminNavIcon}>{item.icon}</span>
                  <span className={styles.adminNavLabel}>{item.label}</span>
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
          <h1>{title || 'Admin Panel'}</h1>
          <div className={styles.adminUser}>
            {user?.username || user?.email} <span className={styles.adminBadge}>Admin</span>
          </div>
        </header>
        
        <main className={styles.adminMain}>
          {children}
        </main>
      </div>
    </div>
  );
} 