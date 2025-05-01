import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/DesktopDashboardHeader.module.css';
import { AiOutlineDashboard, AiOutlineDesktop, AiOutlineShop, AiOutlineTrophy, AiOutlineVideoCamera, AiOutlineCompass, AiOutlineCalendar } from 'react-icons/ai';

const DesktopDashboardHeader = () => {
  const router = useRouter();
  const { user } = useAuth();
  const currentPath = router.pathname;

  // Navigation items for desktop - all in one row
  const navigationItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: <AiOutlineDashboard size={20} />
    },
    {
      path: '/topusers',
      label: 'Top Users',
      icon: <AiOutlineTrophy size={20} />
    },
    {
      path: '/shop',
      label: 'Shop',
      icon: <AiOutlineShop size={20} />
    },
    {
      path: '/events',
      label: 'Events',
      icon: <AiOutlineCalendar size={20} />
    },
    {
      path: '/discover',
      label: 'Discover',
      icon: <AiOutlineCompass size={20} />
    },
    {
      path: '/avcomputers',
      label: 'Computers',
      icon: <AiOutlineDesktop size={20} />
    },
    {
      path: `/profile/${user?.username}`,
      label: 'Profile',
      icon: <AiOutlineVideoCamera size={20} />
    }
  ];

  // Helper function to check if a path is active
  const isActive = (path) => {
    if (path.startsWith('/profile/')) {
      return currentPath.startsWith('/profile/') && path === `/profile/${user?.username}`;
    }
    if (path === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    return currentPath === path;
  };

  // Handle navigation
  const handleNavigation = (path) => {
    router.push(path);
  };

  return (
    <nav className={styles.dashboardHeader} role="navigation" aria-label="Dashboard Navigation">
      <div className={styles.desktopNavContainer}>
        {navigationItems.map((item) => (
          <button
            key={item.path}
            type="button"
            role="link"
            aria-label={item.label}
            className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
            onClick={() => handleNavigation(item.path)}
          >
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default DesktopDashboardHeader; 