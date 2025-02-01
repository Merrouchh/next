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
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const navContainerRef = useRef(null);
  const isScrolling = useRef(false);

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

    let momentumID;
    let velocityX = 0;
    let lastX = 0;
    let lastTime = Date.now();

    const handleTouchStart = (e) => {
      isDragging.current = true;
      isScrolling.current = false;
      startX.current = e.touches[0].pageX - container.offsetLeft;
      scrollLeft.current = container.scrollLeft;
      lastX = e.touches[0].pageX;
      lastTime = Date.now();
      
      cancelAnimationFrame(momentumID);
    };

    const handleTouchMove = (e) => {
      if (!isDragging.current) return;
      
      const x = e.touches[0].pageX - container.offsetLeft;
      const walk = (x - startX.current) * 2;
      container.scrollLeft = scrollLeft.current - walk;
      
      const now = Date.now();
      const dt = now - lastTime;
      const dx = e.touches[0].pageX - lastX;
      velocityX = dx / dt;
      
      lastX = e.touches[0].pageX;
      lastTime = now;
      
      isScrolling.current = true;
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      
      const momentum = () => {
        if (Math.abs(velocityX) > 0.1) {
          container.scrollLeft -= velocityX * 16;
          velocityX *= 0.95;
          momentumID = requestAnimationFrame(momentum);
        } else {
          isScrolling.current = false;
        }
      };
      
      momentum();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(momentumID);
    };
  }, [isMobile]);

  // Initial centering
  useEffect(() => {
    const timer = setTimeout(() => {
      centerActiveButton();
    }, 300);

    return () => clearTimeout(timer);
  }, [centerActiveButton]);

  if (!isLoggedIn) return null;

  const navigationItems = [
    {
      path: '/dashboard',
      label: 'My Profile',
      icon: <AiOutlineDashboard size={20} />
    },
    {
      path: '/discover',
      label: 'Discover',
      icon: <AiOutlineCompass size={20} />
    },
    {
      path: `/profile/${user?.username}`,
      label: 'My Clips',
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
        style={{ scrollBehavior: 'auto' }}
      >
        {displayItems.map((item, index) => (
          <button
            key={`${item.path}-${index}`}
            className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
            onClick={(e) => handleClick(e, item)}
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