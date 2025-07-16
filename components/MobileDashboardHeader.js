import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/MobileDashboardHeader.module.css';
import { AiOutlineDashboard, AiOutlineTrophy, AiOutlineDesktop } from 'react-icons/ai';
import { fetchActiveUserSessions } from '../utils/api';

const MobileDashboardHeader = () => {
  const router = useRouter();
  const { user } = useAuth();
  const currentPath = router.pathname;
  const isDragging = useRef(false);
  const navContainerRef = useRef(null);
  const isScrolling = useRef(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Helper function to format session count
  const formatSessionCount = (activeCount, isLoading) => {
    const totalCapacity = 14;
    if (isLoading) return '--/14';
    return `${activeCount}/${totalCapacity}`;
  };

  // Helper function to get color class based on session count
  const getSessionColorClass = (activeCount, isLoading) => {
    if (isLoading) return '';
    
    if (activeCount >= 14) return 'red';      // Full capacity
    if (activeCount >= 8) return 'orange';   // High usage
    return 'green';                          // Low to moderate usage
  };

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
      path: '/avcomputers',
      label: 'Sessions',
      sublabel: formatSessionCount(Array.isArray(activeSessions) ? activeSessions.length : 0, isLoadingSessions),
      colorClass: getSessionColorClass(Array.isArray(activeSessions) ? activeSessions.length : 0, isLoadingSessions),
      icon: <AiOutlineDesktop size={20} />,
      isSessionsButton: true
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
      // Batch DOM reads to prevent forced reflows
      requestAnimationFrame(() => {
        if (!navContainerRef.current) return;
        
        const containerWidth = container.offsetWidth;
        const buttonWidth = activeButton.offsetWidth;
        const buttonOffsetLeft = activeButton.offsetLeft;
        const scrollLeft = buttonOffsetLeft - (containerWidth / 2) + (buttonWidth / 2);
        
        // Batch DOM writes in a separate frame
        requestAnimationFrame(() => {
          if (navContainerRef.current) {
            container.scrollTo({
              left: scrollLeft,
              behavior: 'smooth'
            });
          }
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
    if (!isScrolling.current && path) {
      router.push(path);
    }
  };

  // Handle button click
  const handleButtonClick = (e, path, isPlaceholder) => {
    e.preventDefault();
    if (!isDragging.current && !isPlaceholder) {
      handleNavigation(path);
    }
  };

  // Fetch active sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessions = await fetchActiveUserSessions();
        setActiveSessions(sessions || []);
        setIsLoadingSessions(false);
      } catch (error) {
        console.error('Error fetching active sessions:', error);
        setActiveSessions([]);
        setIsLoadingSessions(false);
      }
    };

    fetchSessions();

    // Refresh sessions every 5 seconds (but don't show loading state for these)
    const interval = setInterval(() => {
      fetchActiveUserSessions()
        .then(sessions => setActiveSessions(sessions || []))
        .catch(error => {
          console.error('Error fetching active sessions:', error);
          setActiveSessions([]);
        });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Also refresh when page becomes visible (but don't show loading state)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchActiveUserSessions()
          .then(sessions => setActiveSessions(sessions || []))
          .catch(error => {
            console.error('Error fetching active sessions:', error);
            setActiveSessions([]);
          });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <nav className={styles.dashboardHeader} role="navigation" aria-label="Dashboard Navigation">
      <div className={styles.navContainer} ref={navContainerRef}>
        {navigationItems.map((item, index) => (
          <button
            key={item.path || `placeholder-${index}`}
            type="button"
            role={item.isPlaceholder ? "button" : "link"}
            aria-label={item.isPlaceholder ? `${item.label} (placeholder)` : (item.isSessionsButton ? `${item.label} - ${item.sublabel}` : item.label)}
            className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''} ${item.isPlaceholder ? styles.placeholder : ''} ${item.isSessionsButton ? styles.sessionsButton : ''}`}
            onClick={(e) => handleButtonClick(e, item.path, item.isPlaceholder)}
            disabled={item.isPlaceholder}
          >
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
            {item.isSessionsButton ? (
              <span className={`${styles.sublabel} ${item.colorClass ? styles[item.colorClass] : ''}`}>{item.sublabel}</span>
            ) : (
              <span className={styles.label}>{item.label}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default MobileDashboardHeader; 