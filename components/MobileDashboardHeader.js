import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/MobileDashboardHeader.module.css';
import { AiOutlineDashboard, AiOutlineTrophy, AiOutlineShop } from 'react-icons/ai';

const MobileDashboardHeader = () => {
  const router = useRouter();
  const { user } = useAuth();
  const currentPath = router.pathname;
  const isDragging = useRef(false);
  const navContainerRef = useRef(null);
  const isScrolling = useRef(false);

  // Navigation items configuration for mobile - only top items
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
    }
  ];

  // Helper function to check if a path is active
  const isActive = (path) => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    return currentPath === path;
  };

  // Center the active button in mobile view
  const centerActiveButton = () => {
    if (!navContainerRef.current) return;
    
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
    const timer = setTimeout(centerActiveButton, 150);
    return () => clearTimeout(timer);
  }, [currentPath]);

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

  return (
    <nav className={styles.dashboardHeader} role="navigation" aria-label="Dashboard Navigation">
      <div className={styles.navContainer} ref={navContainerRef}>
        {navigationItems.map((item) => (
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
    </nav>
  );
};

export default MobileDashboardHeader; 