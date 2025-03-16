import { useEffect, useRef, useState, useCallback } from 'react';
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

  // Update the navigation groups
  const topNavigationItems = [
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
  ].map((item, _index) => ({
    ...item,
    key: `top-${item.path}`
  }));

  // Desktop-only navigation items
  const desktopOnlyItems = [
    {
      path: '/events',
      label: 'Events',
      icon: <AiOutlineCalendar size={20} />
    }
  ].map((item, _index) => ({
    ...item,
    key: `desktop-${item.path}`
  }));

  const bottomNavigationItems = [
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
  ].map((item, _index) => ({
    ...item,
    key: `bottom-${item.path}`
  }));

  // First, update the isActive function to be more explicit about dashboard paths
  const isActive = (path) => {
    if (path.startsWith('/profile/')) {
      return currentPath.startsWith('/profile/') && path === `/profile/${user?.username}`;
    }
    if (path === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    return currentPath === path;
  };

  // Then update the centerActiveButton function to handle dashboard paths better
  const centerActiveButton = useCallback(() => {
    if (!navContainerRef.current || !isMobile) return;
    
    const container = navContainerRef.current;
    const activeButtons = container.querySelectorAll(`.${styles.active}`);
    
    if (activeButtons.length > 0) {
      // Calculate which set of buttons to use (first, middle, or last)
      let targetIndex;
      if (currentPath === '/dashboard' || currentPath === '/') {
        // For dashboard, always use the first set
        targetIndex = 0;
      } else {
        // For other paths, use the middle set
        const setSize = topNavigationItems.length + bottomNavigationItems.length;
        targetIndex = setSize; // This will target the middle set
      }

      const targetButton = activeButtons[targetIndex];
      
      if (targetButton) {
        const containerWidth = container.offsetWidth;
        const buttonWidth = targetButton.offsetWidth;
        const scrollLeft = targetButton.offsetLeft - (containerWidth / 2) + (buttonWidth / 2);
        
        // Use requestAnimationFrame to ensure smooth scrolling
        requestAnimationFrame(() => {
          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
          });
        });
      }
    }
  }, [isMobile, topNavigationItems.length, bottomNavigationItems.length, currentPath]);

  // Add an additional useEffect specifically for initial dashboard centering
  useEffect(() => {
    if ((currentPath === '/dashboard' || currentPath === '/') && isMobile) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        centerActiveButton();
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [currentPath, isMobile, centerActiveButton]);

  // Check for mobile on client-side only
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Safe navigation function
  const safeNavigate = useCallback(
    (path) => {
      if (!isScrolling.current) {
        router.push(path);
      }
    },
    [router]
  );

  const handleClick = useCallback((e, item) => {
    e.preventDefault();
    if (isDragging.current) {
      return;
    }
    safeNavigate(item.path);
  }, [safeNavigate]);

  // Touch events handling
  useEffect(() => {
    const container = navContainerRef.current;
    if (!container || !isMobile) return;

    let mounted = true;
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
      if (mounted) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      }
      mounted = false;
    };
  }, [isMobile]);

  return (
    <div className={styles.dashboardHeader}>
      <div className={styles.topNav}>
        <div className={styles.navContainer}>
          {(isMobile ? topNavigationItems : [...topNavigationItems, ...desktopOnlyItems, ...bottomNavigationItems]).map((item) => (
            <button
              key={item.key}
              data-path={item.path}
              className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
              onClick={(e) => handleClick(e, item)}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;