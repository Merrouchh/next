import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTopUsers } from '../utils/api';

export const useTopUsers = (limit = 10) => {
  const [state, setState] = useState({
    users: [],
    loading: true,
    error: null,
    lastFetch: null
  });
  
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const cacheRef = useRef(null);
  
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes refresh (reduced from 30s)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check if cached data is still valid
  const isCacheValid = useCallback(() => {
    if (!cacheRef.current) return false;
    const now = Date.now();
    return (now - cacheRef.current.timestamp) < CACHE_DURATION;
  }, []);

  // Fetch top users with caching and retry logic
  const fetchUsers = useCallback(async (isRetry = false) => {
    // Use cache if valid and not a retry
    if (!isRetry && isCacheValid()) {
      setState(prev => ({
        ...prev,
        users: cacheRef.current.data,
        loading: false,
        error: null
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const data = await fetchTopUsers(limit);

      if (data.length === 0 && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setTimeout(() => fetchUsers(true), RETRY_DELAY);
        return;
      }

      // Update cache
      cacheRef.current = {
        data,
        timestamp: Date.now()
      };

      setState({
        users: data,
        loading: false,
        error: data.length === 0 ? 'No users found' : null,
        lastFetch: Date.now()
      });
      
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Error fetching top users:', error);
      
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setTimeout(() => fetchUsers(true), RETRY_DELAY);
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Unable to load users. Please try again later.'
      }));
    }
  }, [limit, isCacheValid]);

  // Force refresh (bypasses cache)
  const forceRefresh = useCallback(() => {
    cacheRef.current = null;
    retryCountRef.current = 0;
    fetchUsers(false);
  }, [fetchUsers]);

  // Initialize data on mount
  useEffect(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  // Auto-refresh with reduced frequency
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !state.loading) {
        fetchUsers(false);
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchUsers, state.loading]);

  // Refresh on visibility change (when user comes back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !state.loading) {
        // Only refresh if data is stale
        if (!isCacheValid()) {
          fetchUsers(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUsers, state.loading, isCacheValid]);

  return {
    users: state.users,
    loading: state.loading,
    error: state.error,
    lastFetch: state.lastFetch,
    refresh: forceRefresh
  };
}; 