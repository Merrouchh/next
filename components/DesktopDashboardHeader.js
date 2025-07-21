import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/DesktopDashboardHeader.module.css';
import { AiOutlineDashboard, AiOutlineDesktop, AiOutlineShop, AiOutlineTrophy, AiOutlineVideoCamera, AiOutlineCompass, AiOutlineCalendar, AiOutlineStar } from 'react-icons/ai';

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
      path: '/awards',
      label: 'Awards',
      icon: <AiOutlineStar size={20} />
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

  // Helper function to check if we're on an event details page
  const isEventDetailsPage = () => {
    return currentPath.startsWith('/events/') && currentPath !== '/events';
  };

  // Helper function to get the appropriate active class
  const getActiveClass = (path) => {
    if (path === '/events') {
      if (isEventDetailsPage()) {
        return styles.activeEventDetails; // Red indicator for event details
      } else if (isActive(path)) {
        return styles.active; // Yellow indicator for events list
      }
    } else if (isActive(path)) {
      return styles.active; // Yellow indicator for other pages
    }
    return '';
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
            className={`${styles.navButton} ${getActiveClass(item.path)}`}
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