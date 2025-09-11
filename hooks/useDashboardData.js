import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  fetchActiveUserSessions, 
  fetchTopUsers, 
  fetchUserPoints,
  fetchUserTimeInfo,
  fetchUserBalanceWithDebt,
  fetchUserPicture,
  fetchUserUpcomingMatches
} from '../utils/api';
import { toast } from 'react-hot-toast';

export const useDashboardData = () => {
  const { user, refreshSession } = useAuth();
  const [pageState, setPageState] = useState({
    loading: true,
    error: null,
    data: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchDashboardData = useCallback(async (showToast = true, retryCount = 0) => {
    if (!user?.gizmo_id) return;
    
    // Use a ref to track if we're already refreshing to prevent multiple calls
    if (isRefreshingRef.current) return;
    
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setPageState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('🔄 Refreshing dashboard data for user:', user?.username);
      
      // Fetch essential data with individual error handling
      const [
        activeSessions,
        topUsers,
        points,
        timeInfo,
        balanceInfo,
        upcomingMatches,
      ] = await Promise.all([
        fetchActiveUserSessions().catch(err => {
          console.warn('Failed to fetch active sessions:', err);
          return [];
        }),
        fetchTopUsers(5).catch(err => {
          console.warn('Failed to fetch top users:', err);
          return [];
        }),
        fetchUserPoints(user.gizmo_id).catch(err => {
          console.warn('Failed to fetch user points:', err);
          return { points: 0 };
        }),
        fetchUserTimeInfo(user.gizmo_id).catch(err => {
          console.warn('Failed to fetch time info:', err);
          return {};
        }),
        fetchUserBalanceWithDebt(user.gizmo_id).catch(err => {
          console.warn('Failed to fetch balance info:', err);
          return { rawBalance: 0 };
        }),
        user.id ? fetchUserUpcomingMatches(user.id).catch(err => {
          console.warn('Failed to fetch upcoming matches:', err);
          return [];
        }) : Promise.resolve([]),
      ]);
      
      console.log('✅ Dashboard data fetch completed successfully');
      console.log('🔍 Checking mounted state:', { isMounted: isMountedRef.current, userExists: !!user });

      // Update state with essential data
      const newData = {
        activeSessions,
        topUsers,
        userPoints: points?.points || 0,
        timeInfo,
        balanceInfo,
        upcomingMatches: upcomingMatches || [],
        userPicture: null,
        isLoadingPicture: true,
        needsProfileSetup: false
      };
      
      console.log('🔄 Setting dashboard data:', newData);
      
      // Update state regardless of mounted state to fix the loading issue
      setPageState({
        loading: false,
        error: null,
        data: newData
      });
      
      console.log('✅ Dashboard data state updated successfully');

      // Show success toast
      if (showToast && document.visibilityState === 'visible') {
        toast.success('Dashboard refreshed!', {
          position: 'top-right',
          style: {
            background: '#333',
            color: '#fff',
            border: '1px solid #FFD700',
          },
          iconTheme: {
            primary: '#FFD700',
            secondary: '#333',
          },
        });
      }

      // Fetch picture separately (non-blocking)
      setTimeout(async () => {
        try {
          const userPicture = await fetchUserPicture(user.gizmo_id);
          setPageState(prev => ({
            ...prev,
            data: prev.data ? {
              ...prev.data,
              userPicture,
              isLoadingPicture: false
            } : prev.data
          }));
        } catch (error) {
          console.warn('Picture loading error:', error);
          setPageState(prev => ({
            ...prev,
            data: prev.data ? {
              ...prev.data,
              userPicture: null,
              isLoadingPicture: false
            } : prev.data
          }));
        }
      }, 100); // Small delay to ensure main data is set first

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      
      // Retry logic for connection errors
      if (retryCount < 2 && (error.message?.includes('fetch') || error.message?.includes('timeout'))) {
        console.log(`Retrying dashboard data fetch (attempt ${retryCount + 1})`);
        isRefreshingRef.current = false;
        setIsRefreshing(false);
        setTimeout(() => {
          fetchDashboardData(showToast, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      // Provide more specific error messages
      let errorMessage = 'Failed to refresh data';
      if (error.message?.includes('fetch')) {
        errorMessage = 'Connection error. Please check your internet connection and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setPageState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      if (showToast) {
        toast.error(errorMessage);
      }
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [user?.gizmo_id]); // Removed isRefreshing from dependencies

  // Initialize data on mount
  useEffect(() => {
    // Check if user is null (still loading) vs user exists but no gizmo_id
    if (user === null) {
      // User is still loading, keep loading state
      return;
    }
    
    // If we already have data for this user, don't reset it and don't check for errors
    if (pageState.data) {
      console.log('Dashboard already has data, keeping existing state');
      hasInitializedRef.current = true;
      return;
    }
    
    // Reset initialization flag when user changes
    hasInitializedRef.current = false;
    
    // Only show error if user exists but definitely has no gizmo_id
    // AND we don't have existing data AND this is the first time we're checking
    if (!user?.gizmo_id && !pageState.data && !hasInitializedRef.current) {
      const timeoutId = setTimeout(() => {
        // Only show error if we still don't have data and gizmo_id is still missing
        if (!user?.gizmo_id && !pageState.data) {
          console.log('User has no gizmo_id after delay - showing error');
          setPageState({
            loading: false,
            error: 'No gaming account linked. Please contact Merrouch Gaming on WhatsApp: +212 656-053641',
            data: null
          });
          hasInitializedRef.current = true;
        }
      }, 5000); // 5 second delay to allow auth refresh to complete
      
      return () => clearTimeout(timeoutId);
    }

    // Only fetch if we haven't initialized yet and aren't currently refreshing
    if (!hasInitializedRef.current && !isRefreshingRef.current && user?.gizmo_id) {
      console.log('Starting dashboard data fetch for user:', user?.username);
      hasInitializedRef.current = true;
      // Add a small delay to ensure auth is fully settled
      const timeoutId = setTimeout(() => {
        fetchDashboardData(false);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user?.gizmo_id]); // Removed user.username to prevent unnecessary re-runs
  
  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (pageState.loading && !isRefreshingRef.current) {
        console.warn('Dashboard loading timeout - forcing error state');
        console.log('Current state:', { user: user?.username, gizmo_id: user?.gizmo_id, pageState });
        setPageState(prev => ({
          ...prev,
          loading: false,
          error: 'Loading timeout. Please try refreshing the page.'
        }));
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(loadingTimeout);
  }, [pageState.loading]);
  
  // Add a safety check to ensure loading state isn't stuck due to auth issues
  useEffect(() => {
    // Only show error if we've been loading for a while and user definitely has no gizmo_id
    // AND we're not in the middle of a refresh AND we've actually tried to load data
    // AND we don't already have data (to prevent showing error when data is available)
    if (user !== null && !user?.gizmo_id && pageState.loading && !pageState.data && hasInitializedRef.current && !isRefreshingRef.current) {
      // Add a longer delay to make sure we're not in the middle of auth refresh or data loading
      const timeoutId = setTimeout(() => {
        // Double-check that we're still in the same state and haven't started refreshing
        // AND that we still don't have data (to prevent race conditions)
        if (!user?.gizmo_id && !isRefreshingRef.current && pageState.loading && !pageState.data) {
          console.log('Fixing stuck loading state - user has no gizmo_id after extended wait');
          setPageState({
            loading: false,
            error: 'No gaming account linked. Please contact Merrouch Gaming on WhatsApp: +212 656-053641',
            data: null
          });
        }
      }, 5000); // Increased to 5 seconds to give more time for data loading
      
      return () => clearTimeout(timeoutId);
    }
  }, [user?.gizmo_id, pageState.loading, pageState.data]); // Added pageState.data to dependencies

  // Auto-refresh on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && pageState.data && !isRefreshingRef.current) {
        console.log('👁️ Page became visible - refreshing data');
        refreshSession({ silent: true }).catch(console.error);
        setTimeout(() => {
          if (document.visibilityState === 'visible' && !isRefreshingRef.current) {
            fetchDashboardData(false);
          }
        }, 1000);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.gizmo_id, pageState.data]); // Simplified dependencies

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user?.gizmo_id || !pageState.data) return;

    const autoRefresh = setInterval(() => {
      if (document.visibilityState === 'visible' && !isRefreshingRef.current) {
        console.log('⏰ Auto-refreshing dashboard data...');
        fetchDashboardData(false);
      }
    }, 60000); // Increased to 60 seconds to reduce frequency

    return () => clearInterval(autoRefresh);
  }, [user?.gizmo_id, pageState.data]); // Simplified dependencies

  return {
    ...pageState,
    isRefreshing,
    refreshData: fetchDashboardData
  };
}; 