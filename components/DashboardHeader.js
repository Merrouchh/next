import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/DashboardHeader.module.css';
import { AiOutlineDashboard, AiOutlineDesktop, AiOutlineShop, AiOutlineTrophy, AiOutlineVideoCamera, AiOutlineCompass } from 'react-icons/ai';

export default function DashboardHeader() {
  const router = useRouter();
  const { isLoggedIn, user, userData } = useAuth();
  const currentPath = router.pathname;
  const [isMobile, setIsMobile] = useState(false);
  const isDragging = useRef(false);
  const navContainerRef = useRef(null);
  const isScrolling = useRef(false);

  // Center active button on mount and route change
  useEffect(() => {
    if (isMobile && navContainerRef.current) {
      const container = navContainerRef.current;
      const activeButton = container.querySelector(`.${styles.active}`);
      
      if (activeButton) {
        const containerWidth = container.offsetWidth;
        const buttonWidth = activeButton.offsetWidth;
        const scrollLeft = activeButton.offsetLeft - (containerWidth / 2) + (buttonWidth / 2);
        
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  }, [currentPath, isMobile]);

  // Check for mobile on client-side only
  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounce function to prevent rapid navigation
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Safe navigation function
  const safeNavigate = useCallback(
    debounce((path) => {
      if (!isScrolling.current) {
        router.push(path);
      }
    }, 100),
    [router]
  );

  // Center active button function
  const centerActiveButton = useCallback(() => {
    if (!navContainerRef.current || !isMobile) return;
    
    const container = navContainerRef.current;
    const activeButtons = container.querySelectorAll(`.${styles.active}`);
    
    if (activeButtons.length > 0) {
      const middleIndex = Math.floor(activeButtons.length / 2);
      const middleButton = activeButtons[middleIndex];
      
      if (middleButton) {
        const scrollLeft = middleButton.offsetLeft - (container.offsetWidth / 2) + (middleButton.offsetWidth / 2);
        
        setTimeout(() => {
          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [isMobile]);

  // Handle page load and route changes
  useEffect(() => {
    centerActiveButton();
  }, [currentPath, centerActiveButton]);

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

  // Initial centering
  useEffect(() => {
    const timer = setTimeout(() => {
      centerActiveButton();
    }, 300);

    return () => clearTimeout(timer);
  }, [centerActiveButton]);

  useEffect(() => {
    const handleScroll = () => {
      // Your scroll handling logic
    };

    window.addEventListener('scroll', handleScroll);
    
    // Make sure to remove the listener
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isLoggedIn) return null;

  const navigationItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: <AiOutlineDashboard size={20} />
    },
    {
      path: '/discover',
      label: 'Discover',
      icon: <AiOutlineCompass size={20} />
    },
    {
      path: `/profile/${user?.username}`,
      label: 'Profile',
      icon: <AiOutlineVideoCamera size={20} />
    },
    {
      path: '/avcomputers',
      label: 'Computers',
      icon: <AiOutlineDesktop size={20} />
    },
    {
      path: '/shop',
      label: 'Shop',
      icon: <AiOutlineShop size={20} />
    },
    {
      path: '/topusers',
      label: 'Top Users',
      icon: <AiOutlineTrophy size={20} />
    }
  ];

  const displayItems = isMobile 
    ? [...navigationItems, ...navigationItems, ...navigationItems]
    : navigationItems;

  const isActive = (path) => {
    if (path.startsWith('/profile/')) {
      return currentPath.startsWith('/profile/') && path === `/profile/${user?.username}`;
    }
    return currentPath === path;
  };

  return (
    <div className={styles.dashboardHeader}>
      <div 
        className={styles.navContainer} 
        ref={navContainerRef}
        style={{ 
          scrollBehavior: 'smooth',
          scrollSnapType: isMobile ? 'x mandatory' : 'none',
          WebkitOverflowScrolling: 'touch',
          overflowX: 'auto'
        }}
      >
        {displayItems.map((item, index) => (
          <button
            key={`${item.path}-${index}`}
            className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
            onClick={(e) => handleClick(e, item)}
            style={{
              scrollSnapAlign: isMobile ? 'center' : 'none',
              flexShrink: 0
            }}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </div>
      <span className={styles.username}>{userData?.username}</span>
    </div>
  );
} 