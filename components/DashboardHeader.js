import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/DashboardHeader.module.css';
import { AiOutlineDashboard, AiOutlineDesktop, AiOutlineShop, AiOutlineTrophy, AiOutlineVideoCamera, AiOutlineCompass, AiOutlineCalendar } from 'react-icons/ai';

// Update the styles for DashboardHeader
const _updatedDashboardHeaderStyles = {
  dashboardHeader: {
    backgroundColor: 'var(--dark-bg-secondary)',
    borderBottom: '1px solid var(--dark-border)'
  },
  navButton: {
    backgroundColor: 'var(--dark-bg-elevated)',
    color: 'var(--dark-text-secondary)',
    '&:hover': {
      backgroundColor: 'var(--dark-hover)'
    },
    '&.active': {
      backgroundColor: 'var(--dark-accent-primary)',
      color: 'var(--dark-text-primary)'
    }
  }
};

const DashboardHeader = () => {
  const router = useRouter();
  const { user } = useAuth();
  const currentPath = router.pathname;
  const [isMobile, setIsMobile] = useState(false);
  const isDragging = useRef(false);
  const navContainerRef = useRef(null);
  const isScrolling = useRef(false);

  // Check for mobile on client-side only
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Navigation items configuration
  const navigationItems = {
    top: [
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
    }
    ],
    desktop: [
    {
      path: '/events',
      label: 'Events',
      icon: <AiOutlineCalendar size={20} />
    }
    ],
    bottom: [
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
    ]
  };

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

  // Center the active button in mobile view
  const centerActiveButton = () => {
    if (!navContainerRef.current || !isMobile) return;
    
    const container = navContainerRef.current;
    const activeButton = container.querySelector(`.${styles.active}`);
    
    if (activeButton) {
        const containerWidth = container.offsetWidth;
      const buttonWidth = activeButton.offsetWidth;
      const scrollLeft = activeButton.offsetLeft - (containerWidth / 2) + (buttonWidth / 2);
        
        requestAnimationFrame(() => {
          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
          });
        });
      }
  };

  // Center active button on initial load and route changes
  useEffect(() => {
    if (isMobile) {
      const timer = setTimeout(centerActiveButton, 150);
      return () => clearTimeout(timer);
    }
  }, [currentPath, isMobile]);

  // Handle navigation
  const handleNavigation = (path) => {
      if (!isScrolling.current) {
        router.push(path);
      }
  };

  // Handle button click
  const handleButtonClick = (e, path) => {
    e.preventDefault();
    if (!isDragging.current) {
      handleNavigation(path);
    }
  };

  // Touch events for mobile scrolling
  useEffect(() => {
    const container = navContainerRef.current;
    if (!container || !isMobile) return;

    let isComponentMounted = true;
    let startX = 0;
    let scrollLeft = 0;
    let isDown = false;

    const handleTouchStart = (e) => {
      isDown = true;
      startX = e.touches[0].pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
      container.style.scrollBehavior = 'auto';
    };

    const handleTouchMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.touches[0].pageX - container.offsetLeft;
      const walk = (startX - x) * 2;
      container.scrollLeft = scrollLeft + walk;
    };

    const handleTouchEnd = () => {
      isDown = false;
      container.style.scrollBehavior = 'smooth';

      // Find the nearest button to snap to
      const containerWidth = container.offsetWidth;
      const buttons = container.querySelectorAll(`.${styles.navButton}`);
      const scrollCenter = container.scrollLeft + containerWidth / 2;
      
      let closestButton = null;
      let minDistance = Infinity;

      buttons.forEach(button => {
        const buttonCenter = button.offsetLeft + button.offsetWidth / 2;
        const distance = Math.abs(buttonCenter - scrollCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestButton = button;
        }
      });

      if (closestButton) {
        const targetScroll = closestButton.offsetLeft - (containerWidth - closestButton.offsetWidth) / 2;
        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      if (isComponentMounted) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      }
      isComponentMounted = false;
    };
  }, [isMobile]);

  // Get the appropriate navigation items based on viewport
  const getNavigationItems = () => {
    if (isMobile) {
      return navigationItems.top;
    }
    return [...navigationItems.top, ...navigationItems.desktop, ...navigationItems.bottom];
  };

  return (
    <div className={styles.dashboardHeader}>
        <div className={styles.topNav}>
          <div className={styles.navContainer} ref={navContainerRef}>
          {getNavigationItems().map((item) => (
              <button
              key={item.path}
              type="button"
              role="link"
              aria-label={item.label}
                className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
              onClick={(e) => handleButtonClick(e, item.path)}
              >
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
    </div>
  );
};

export default DashboardHeader;