import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTopUsers } from '../utils/api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const REFRESH_INTERVAL = 30 * 1000; // 30 seconds refresh - no caching, always fresh

export const useTopUsers = (limit = 10) => {
  const [state, setState] = useState({
    users: [],
    loading: true,
    error: null,
    lastFetch: null
  });
  
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch top users with retry logic - no caching
  const fetchUsers = useCallback(async (_isRetry = false) => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const data = await fetchTopUsers(limit);

      if (data.length === 0 && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setTimeout(() => fetchUsers(true), RETRY_DELAY);
        return;
      }

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
  }, [limit]);

  // Force refresh - always fetches fresh data
  const forceRefresh = useCallback(() => {
    retryCountRef.current = 0;
    fetchUsers(false);
  }, [fetchUsers]);

  // Initialize data on mount
  useEffect(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  // Auto-refresh - always fetch fresh data
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !state.loading) {
        fetchUsers(false);
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchUsers, state.loading]);

  // Refresh on visibility change (when user comes back to tab) - always fresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !state.loading) {
        // Always refresh when tab becomes visible - no caching
        fetchUsers(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUsers, state.loading]);

  return {
    users: state.users,
    loading: state.loading,
    error: state.error,
    lastFetch: state.lastFetch,
    refresh: forceRefresh
  };
}; 