import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import styles from '../../styles/Dashboard.module.css';

const SessionRefreshButton = () => {
  const { refreshSession, isRefreshing } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSessionRefresh = async () => {
    if (isRefreshing) return; // Prevent multiple refreshes
    
    setIsLoading(true);
    try {
      const result = await refreshSession();
      
      if (result?.success) {
        toast.success('Session refreshed!');
        // Wait a moment before reloading
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error('Session refresh failed');
        window.location.reload();
      }
    } catch (e) {
      console.error('Session refresh failed:', e);
      window.location.reload();
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <button 
      onClick={handleSessionRefresh}
      className={`${styles.retryButton} ${styles.sessionButton}`}
      disabled={isLoading || isRefreshing}
    >
      {isLoading || isRefreshing ? 'Refreshing...' : 'Refresh Session & Retry'}
    </button>
  );
};

export default SessionRefreshButton; 