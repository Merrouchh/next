import { useCallback, useRef, useState, useEffect } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useDashboardData } from '../hooks/useDashboardData';
import { toast } from 'react-hot-toast';
import { AiOutlineReload } from 'react-icons/ai';
import styles from '../styles/Dashboard.module.css';

const DashboardRefreshButton = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { loading, isRefreshing, refreshData } = useDashboardData();
  const lastRefreshTime = useRef(0);
  const refreshAttempts = useRef(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Check if button has already animated (persist across page navigations)
  useEffect(() => {
    const animated = sessionStorage.getItem('refresh-button-animated');
    if (animated === 'true') {
      setHasAnimated(true);
    } else {
      // Mark as animated after first render
      setTimeout(() => {
        setHasAnimated(true);
        sessionStorage.setItem('refresh-button-animated', 'true');
      }, 500);
    }
  }, []);

  const handleRefreshClick = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;
    
    if (lastRefreshTime.current === 0) {
      lastRefreshTime.current = now;
      refreshData(true);
      return;
    }
    
    if (timeSinceLastRefresh < 2000) {
      toast.error('Slow down! Wait a moment before refreshing again 🔄', {
        duration: 2000,
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #ff9800',
        }
      });
      return;
    }
    
    if (timeSinceLastRefresh < 60000) {
      refreshAttempts.current++;
      if (refreshAttempts.current > 3) {
        toast.error('Please wait before refreshing again! 😅', {
          duration: 3000,
          position: 'top-right',
          style: {
            background: '#333',
            color: '#fff',
            border: '1px solid #ff4444',
          }
        });
        return;
      }
    } else {
      refreshAttempts.current = 0;
    }
    
    lastRefreshTime.current = now;
    refreshData(true);
  }, [refreshData]);

  if (!isMobile) return null;

  return (
    <button 
      id="floating-refresh-button"
      className={`${styles.floatingRefreshButton} ${hasAnimated ? styles.alreadyAnimated : ''}`}
      onClick={handleRefreshClick}
      disabled={loading || isRefreshing}
      aria-label="Refresh dashboard data"
      title="Refresh dashboard data"
    >
      <AiOutlineReload className={loading || isRefreshing ? styles.spinning : ''} />
      <span className={styles.refreshButtonText}>Refresh</span>
    </button>
  );
};

export default DashboardRefreshButton;

