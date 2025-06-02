import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/component';
import { useRouter } from 'next/router';
import { fetchGizmoId } from '../utils/api';
import { isPublicRoute, isProtectedRoute } from '../utils/routeConfig';

// Error messages
const AUTH_ERRORS = {
  USER_NOT_FOUND: 'User not found',
  INVALID_PASSWORD: 'Invalid password',
  RATE_LIMIT: 'Too many attempts. Please try again later.',
  GENERIC_ERROR: 'An unexpected error occurred',
  SESSION_EXPIRED: 'Session expired. Please login again'
};

// Create context with default value
const AuthContext = createContext({
  isLoggedIn: false,
  user: null,
  loading: true,
  initialized: false
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider = ({ children, onError }) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const initRef = useRef(false);
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    user: null,
    loading: true,
    initialized: false
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabaseRef = useRef(null);

  // Initialize BroadcastChannel for cross-tab communication
  const [broadcastChannel, setBroadcastChannel] = useState(null);

  // Initialize Supabase client only on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    setMounted(true);
  }, []);

  // Add a function to force auth state reload from localStorage
  const forceSessionReload = useCallback(async () => {
    if (!supabaseRef.current) return { success: false, error: 'Supabase client not initialized' };
    
    try {
      console.log('Auth: Force-reloading session from storage');
      
      // First try to get session from storage
      const { data: { session }, error } = await supabaseRef.current.auth.getSession();
      
      if (error) {
        console.error('Auth: Error getting session during force reload:', error);
        return { success: false, error };
      }
      
      if (!session) {
        console.warn('Auth: No session found during force reload');
        return { success: false, error: { message: 'No session found' } };
      }
      
      console.log('Auth: Session found during force reload, getting user data');
      
      // Get the current auth user
      const { data: { user: authUser }, error: userError } = await supabaseRef.current.auth.getUser();
      
      if (userError || !authUser) {
        console.error('Auth: No auth user found during force reload');
        return { success: false, error: userError || { message: 'No user found' } };
      }
      
      // Get user data from public.users based on auth user ID
      const { data: userData, error: userDataError } = await supabaseRef.current
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (userDataError) {
        console.error('Error fetching user data during force reload:', userDataError);
        return { success: false, error: userDataError };
      }
      
      if (userData) {
        // Update auth state with user data
        const processedUserData = {
          ...userData,
          isAdmin: userData.is_admin,
          email: authUser.email // Always use the email from auth
        };
        
        console.log('Auth: Updating state with reloaded user data:', processedUserData.email);
        
        setAuthState({
          isLoggedIn: true,
          user: processedUserData,
          loading: false,
          initialized: true
        });
        
        return { success: true, user: processedUserData };
      }
      
      return { success: false, error: { message: 'User data not found' } };
    } catch (error) {
      console.error('Auth: Error during force reload:', error);
      return { success: false, error };
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!mounted) return;
    if (initRef.current) return;
    initRef.current = true;

    const getInitialSession = async () => {
      try {
        console.log('Auth: Starting initial session check');
        let { data: { session }, error: sessionError } = await supabaseRef.current.auth.getSession();
        
        console.log('Auth: Initial session check', session ? 'Found session' : 'No session found'); // Debug log

        if (sessionError) {
          console.error('Session error:', sessionError);
          // Try to recover by refreshing the session
          try {
            console.log('Auth: Attempting to refresh session after error');
            const { data: refreshData } = await supabaseRef.current.auth.refreshSession();
            if (refreshData?.session) {
              console.log('Auth: Session refresh successful');
              // Continue with the refreshed session
              session = refreshData.session;
            } else {
              console.log('Auth: Session refresh failed, continuing without session');
              setAuthState(prev => ({
                ...prev,
                loading: false,
                initialized: true
              }));
              return;
            }
          } catch (refreshError) {
            console.error('Session refresh error:', refreshError);
            setAuthState(prev => ({
              ...prev,
              loading: false,
              initialized: true
            }));
            return;
          }
        }
        
        if (session?.user) {
          console.log('Auth: Found existing session, getting user data');
          
          // Get the current auth user (source of truth for email)
          const { data: { user: authUser } } = await supabaseRef.current.auth.getUser();
          
          if (!authUser) {
            console.error('Auth: No auth user found despite having a session');
            // Try session refresh one more time
            const { data: refreshData } = await supabaseRef.current.auth.refreshSession();
            if (!refreshData?.session) {
              console.log('Auth: Session refresh failed after missing auth user');
              setAuthState(prev => ({
                ...prev,
                loading: false,
                initialized: true
              }));
              return;
            }
          }
          
          // Get user data from public.users based on auth user ID
          const { data: userData, error: userDataError } = await supabaseRef.current
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          
          if (userDataError) {
            console.error('Error fetching user data:', userDataError);
            setAuthState(prev => ({
              ...prev,
              loading: false,
              initialized: true
            }));
            return;
          }
          
          if (userData) {
            // Combine data and ensure auth email is used
            const processedUserData = {
              ...userData,
              isAdmin: userData.is_admin,
              email: authUser.email // Always use the email from auth
            };
            
            console.log('Initial user data loaded:', processedUserData);
            console.log('Admin status:', processedUserData.isAdmin);
            
            setAuthState({
              isLoggedIn: true,
              user: processedUserData,
              loading: false,
              initialized: true
            });

            // Only redirect to dashboard if we're on the home page
            if (router.pathname === '/') {
              await router.replace('/dashboard');
            }
          } else {
            setAuthState(prev => ({
              ...prev,
              loading: false,
              initialized: true
            }));
          }
        } else {
          setAuthState(prev => ({
            ...prev,
            loading: false,
            initialized: true
          }));
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        setAuthState(prev => ({
          ...prev,
          loading: false,
          initialized: true
        }));
      }
    };

    getInitialSession();
  }, [mounted, router]);

  // Session check function
  const checkSession = useCallback(async () => {
    if (!mounted || !supabaseRef.current) return;

    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session && authState.isLoggedIn) {
        setAuthState(prev => ({
          ...prev,
          isLoggedIn: false,
          loading: false
        }));
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  }, [authState.isLoggedIn, mounted]);

  // Handle focus and visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && authState.isLoggedIn) {
        checkSession();
      }
    };

    const handleFocus = () => {
      if (authState.isLoggedIn) {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authState.isLoggedIn, checkSession]);

  // Extract common refresh logic to a single function
  const refreshUserSession = async (retryOptions = {}) => {
    const { maxRetries = 3, shouldNotifyTabs = false, silent = false } = retryOptions;
    console.log('Auth: Refreshing session', silent ? '(silent mode)' : '');
    
    // Only set loading state when not in silent mode
    if (!silent) {
      setIsRefreshing(true);
    }
    
    try {
      let retryCount = 0;
      
      const attemptRefresh = async () => {
        try {
          console.log('Auth: Checking current session');
          const { data: { session }, error } = await supabaseRef.current.auth.getSession();
          
          if (error) {
            console.error('Auth: Error getting session:', error);
            throw error;
          }
          
          if (!session) {
            console.warn('Auth: No active session found during refresh');
            throw new Error(AUTH_ERRORS.SESSION_EXPIRED);
          }

          console.log('Auth: Refreshing session');
          // Refresh session
          const { data: refreshData, error: refreshError } = await supabaseRef.current.auth.refreshSession();
          
          if (refreshError) {
            console.error('Auth: Session refresh error:', refreshError);
            throw refreshError;
          }

          // Update user data if refresh successful
          if (refreshData?.session) {
            console.log('Auth: Session refresh successful, updating user data');
            
            // Get the current auth user (source of truth for email)
            const { data: { user: authUser } } = await supabaseRef.current.auth.getUser();
            
            // Get user data from public.users using user id
            const { data: userData, error: userError } = await supabaseRef.current
              .from('users')
              .select('*')
              .eq('id', authUser.id)
              .single();

            if (userError) throw userError;

            // Map is_admin to isAdmin for consistency and use auth email
            const processedUserData = userData ? {
              ...userData,
              isAdmin: userData.is_admin,
              email: authUser.email // Always use the email from auth user
            } : null;

            console.log('Refreshed user data:', processedUserData);

            // Only update auth state when not in silent mode
            if (!silent) {
              setAuthState({
                isLoggedIn: true,
                user: processedUserData,
                loading: false,
                initialized: true
              });
            }
            
            // Notify other tabs if requested
            if (shouldNotifyTabs) {
              notifyTabs({ type: 'SESSION_REFRESHED' });
            }
            
            return { success: true, session: refreshData.session, user: processedUserData };
          } else {
            throw new Error('No session data returned');
          }
        } catch (error) {
          console.error('Session refresh error:', error);
          if (retryCount < maxRetries) {
            retryCount++;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            return attemptRefresh();
          }
          throw error;
        }
      };

      return await attemptRefresh();
    } catch (error) {
      console.error('Session refresh failed after retries:', error);
      // If all retries failed, check if we should log out the user
      if (error.message === AUTH_ERRORS.SESSION_EXPIRED) {
        console.warn('Session expired, logging out user');
        // Don't immediately log out - just update the state and let the user try to perform an action
        setAuthState(prev => ({
          ...prev,
          isLoggedIn: false,
          loading: false
        }));
      }
      return { success: false, error };
    } finally {
      setIsRefreshing(false);
    }
  };

  // Add a simpler refresh function to expose to components
  const refreshUserData = async () => {
    console.log('Auth: Explicit user data refresh requested');
    return refreshUserSession({ 
      shouldNotifyTabs: true 
    });
  };

  // Session refresh logic for automatic periodic refresh
  useEffect(() => {
    const REFRESH_INTERVAL = 60 * 60 * 1000; // 60 minutes refresh interval (extended from 20)
    
    // Set up refresh interval when logged in
    let refreshTimer = null;
    if (authState.isLoggedIn && mounted) {
      // Initial refresh - done silently
      const silentRefresh = async () => {
        try {
          console.log('Auth: Silent session refresh');
          // Don't set loading state for background refreshes
          const { data: { session }, error } = await supabaseRef.current.auth.getSession();
          
          if (error || !session) {
            console.error('Silent refresh error:', error);
            return;
          }
          
          // Just refresh the token without updating state
          const { data: refreshData, error: refreshError } = await supabaseRef.current.auth.refreshSession();
          
          if (refreshError) {
            console.error('Silent refresh error:', refreshError);
            return;
          }
          
          console.log('Auth: Silent session refresh completed');
        } catch (e) {
          console.error('Silent refresh error:', e);
        }
      };
      
      // Instead of calling refreshUserSession which sets loading states, use silentRefresh
      silentRefresh();
      refreshTimer = setInterval(silentRefresh, REFRESH_INTERVAL);
    }
    
    return () => {
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [authState.isLoggedIn, mounted]);

  // Add effect to handle magic link authentication
  useEffect(() => {
    if (!mounted) return;

    const handleMagicLink = async () => {
      try {
        // Get the hash from the URL if it exists
        const hash = window.location.hash;
        console.log('Checking for magic link hash:', hash);
        
        if (!hash) return;
        
        // Convert the hash to URLSearchParams for easier parsing
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Check if this is a magic link
        const isMagicLink = type === 'magiclink' || hash.includes('type=magiclink');

        if (accessToken && refreshToken) {
          console.log('Magic link hash detected, setting session...', { isMagicLink });
          
          try {
            // Set the session with the tokens
            const { data: { session }, error } = await supabaseRef.current.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (error) {
              console.error('Error setting session from hash:', error);
              throw error;
            }

            if (session?.user) {
              console.log('Magic link authentication successful, session established');
              
              // Get auth user data first (source of truth for email)
              const { data: { user: authUser } } = await supabaseRef.current.auth.getUser();
              
              if (!authUser) {
                console.error('No auth user found after setting session');
                throw new Error('Authentication failed - no user found');
              }
              
              // Get user data from public.users based on user id
              const { data: userData, error: userDataError } = await supabaseRef.current
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();
              
              if (userDataError) {
                console.error('Error fetching user data:', userDataError);
                throw userDataError;
              }
              
              if (userData) {
                // Update the auth state with the user data
                setAuthState({
                  isLoggedIn: true,
                  user: {
                    ...userData,
                    email: authUser.email, // Always use the email from auth
                    isAdmin: userData.is_admin
                  },
                  loading: false,
                  initialized: true
                });

                // Clear the URL hash after successful authentication
                if (typeof window !== 'undefined') {
                  // Use history API to clear the hash without a refresh
                  window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }
                
                // Redirect to dashboard only if on the homepage
                if (router.pathname === '/') {
                  router.replace('/dashboard');
                }
                
                return; // Exit early on success
              }
            }
            
            // If we get here, something went wrong with the authentication
            throw new Error('Authentication failed');
          } catch (error) {
            console.error('Error processing magic link hash:', error);
            // No fallback attempt - just propagate the error
            throw error;
          }
        }
      } catch (error) {
        console.error('Error handling magic link:', error);
        setError('Error logging in with magic link');
      }
    };

    handleMagicLink();
  }, [mounted, router.pathname]);

  // Simplified loading check
  const shouldShowLoading = () => {
    // Don't show loading on public routes
    if (!mounted || isPublicRoute(router.pathname)) {
      return false;
    }

    // Only show loading if we're actually loading and on a protected route
    return (authState.loading && !authState.initialized) && isProtectedRoute(router.pathname);
  };

  // Function to fetch user data
  const fetchUserData = async (identifier) => {
    if (!identifier) return null;

    try {
      // If this is an email, we'll try to find the user directly
      const isEmail = identifier.includes('@');
      
      // Look up the user in the public.users table
      const { data, error } = await supabaseRef.current
        .from('users')
        .select(`id, username, email, is_admin, gizmo_id, created_at`)
        .or(
          isEmail 
            ? `email.eq.${identifier.toLowerCase()}` 
            : `username.eq.${identifier.toLowerCase()}`
        )
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - not necessarily an error for our use case
          return null;
        }
        throw error;
      }
      
      if (data) {
        // If we're in a session context, try to get the auth user's email
        try {
          const { data: { user: authUser } } = await supabaseRef.current.auth.getUser();
          
          // If the auth user ID matches our found user ID, use the auth email
          if (authUser && authUser.id === data.id) {
            return {
              ...data,
              isAdmin: data.is_admin,
              // Use auth email if available (more up-to-date)
              email: authUser.email
            };
          }
        } catch (authError) {
          // If we can't get the auth user, just use the data from public.users
          console.log('Could not get auth user, using public.users data', authError);
        }
        
        console.log('Raw user data from DB:', data);
        return {
          ...data,
          isAdmin: data.is_admin
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Update login function
  const login = async (identifier, password) => {
    setIsLoading(true);
    setError(null);

    try {
      // Trim the identifier to remove any leading/trailing spaces
      identifier = identifier.trim();
      
      // Check if identifier is an email
      const isEmail = identifier.includes('@');
      let email;
      
      if (isEmail) {
        // If email, we can directly try to sign in
        email = identifier.toLowerCase();
      } else {
        // If username, first get the corresponding user from the public.users table
        const { data: userData, error: userError } = await supabaseRef.current
          .from('users')
          .select('email')
          .eq('username', identifier.toLowerCase())
          .single();

        if (userError || !userData?.email) {
          setError('User not found');
          return { success: false, message: 'User not found' };
        }
        
        // Use the email from the users table for authentication
        email = userData.email;
      }

      try {
        // Sign in with Supabase using email
        const { data, error: signInError } = await supabaseRef.current.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            return { success: false, message: 'Incorrect password' };
          }
          throw signInError;
        }

        // Get the auth user
        const { data: { user: authUser } } = await supabaseRef.current.auth.getUser();

        // Get full user data from public.users using the auth user ID
        const { data: fullUserData, error: fullUserError } = await supabaseRef.current
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (fullUserError) throw fullUserError;

        // Update auth state with the combined data, using auth email as source of truth
        setAuthState({
          isLoggedIn: true,
          user: {
            ...fullUserData,
            email: authUser.email, // Always use the email from auth
            isAdmin: fullUserData.is_admin
          },
          loading: false,
          initialized: true
        });

        // Only redirect to dashboard if we're on the home page
        if (router.pathname === '/') {
          await router.replace('/dashboard');
        }

        return { success: true };
      } catch (error) {
        console.error('Login error:', error);
        return {
          success: false,
          message: error.message.includes('rate limit') 
            ? 'Too many attempts. Please try again later.'
            : 'An error occurred. Please try again.'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'An error occurred. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  // Setup broadcast channel on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let channel = null;

      // Try to use BroadcastChannel API if available
      try {
        channel = new BroadcastChannel('auth_sync_channel');
        setBroadcastChannel(channel);
        
        // Listen for auth events from other tabs
        channel.onmessage = async (event) => {
          console.log('Auth: Received broadcast message', event.data.type);
          
          if (event.data.type === 'SIGNED_OUT') {
            console.log('Auth: Another tab signed out, updating state');
            
            // Clean up browser push subscription only (no server cleanup since session is gone)
            if (typeof window !== 'undefined') {
              try {
                console.log('🔔 Cleaning up browser push subscription after logout from another tab...');
                
                // Import cleanup function dynamically
                const { unsubscribeFromPush } = await import('../utils/webPush');
                const result = await unsubscribeFromPush();
                
                if (result.success) {
                  console.log('✅ Browser push subscription cleaned up after cross-tab logout');
                } else {
                  console.log('⚠️ Browser push cleanup failed after cross-tab logout:', result.error);
                }
              } catch (pushError) {
                console.log('⚠️ Could not cleanup browser push subscription:', pushError);
              }
            }
            
            setAuthState({
              user: null,
              isLoggedIn: false,
              loading: false,
              initialized: true
            });
            
            // Redirect to home if on a protected route
            if (!isPublicRoute(router.pathname) && isProtectedRoute(router.pathname)) {
              router.push('/');
            }
          } else if (event.data.type === 'SESSION_REFRESHED') {
            console.log('Auth: Session refreshed in another tab, refreshing here as well');
            checkSession();
          }
        };
      } catch (error) {
        console.warn('BroadcastChannel not supported, falling back to localStorage:', error);
        
        // Set up localStorage event listener as fallback
        const handleStorageEvent = async (event) => {
          if (event.key === 'auth-sync') {
            try {
              const data = JSON.parse(event.newValue);
              console.log('Auth: Received localStorage message', data.type);
              
              if (data.type === 'SIGNED_OUT') {
                console.log('Auth: Another tab signed out via localStorage, updating state');
                
                // Clean up browser push subscription only (no server cleanup since session is gone)
                if (typeof window !== 'undefined') {
                  try {
                    console.log('🔔 Cleaning up browser push subscription after logout from another tab...');
                    
                    // Import cleanup function dynamically
                    const { unsubscribeFromPush } = await import('../utils/webPush');
                    const result = await unsubscribeFromPush();
                    
                    if (result.success) {
                      console.log('✅ Browser push subscription cleaned up after cross-tab logout');
                    } else {
                      console.log('⚠️ Browser push cleanup failed after cross-tab logout:', result.error);
                    }
                  } catch (pushError) {
                    console.log('⚠️ Could not cleanup browser push subscription:', pushError);
                  }
                }
                
                setAuthState({
                  user: null,
                  isLoggedIn: false,
                  loading: false,
                  initialized: true
                });
                
                // Redirect to home if on a protected route
                if (!isPublicRoute(router.pathname) && isProtectedRoute(router.pathname)) {
                  router.push('/');
                }
              } else if (data.type === 'SESSION_REFRESHED') {
                console.log('Auth: Session refreshed in another tab via localStorage, refreshing here as well');
                checkSession();
              }
            } catch (error) {
              console.error('Error processing localStorage auth sync event:', error);
            }
          }
        };
        
        window.addEventListener('storage', handleStorageEvent);
        
        return () => {
          window.removeEventListener('storage', handleStorageEvent);
        };
      }
      
      return () => {
        if (channel) {
          channel.close();
        }
      };
    }
  }, [mounted, router.pathname, checkSession]);

  // Function to notify other tabs about auth changes (with localStorage fallback)
  const notifyTabs = (message) => {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(message);
      } catch (error) {
        console.error('Failed to broadcast message:', error);
      }
    } else if (typeof window !== 'undefined') {
      // Fallback to localStorage for browsers without BroadcastChannel support
      try {
        localStorage.setItem('auth-sync', JSON.stringify({
          ...message,
          timestamp: new Date().getTime()
        }));
        
        // Immediately remove and set again to trigger storage events in all tabs
        const value = localStorage.getItem('auth-sync');
        localStorage.removeItem('auth-sync');
        setTimeout(() => {
          localStorage.setItem('auth-sync', value);
        }, 0);
      } catch (error) {
        console.error('Failed to use localStorage fallback for sync:', error);
      }
    }
  };

  // Modified logout to broadcast to other tabs and cleanup push subscriptions
  const logout = async () => {
    try {
      setIsLoggingOut(true);

      // Clean up push subscriptions before logout
      if (typeof window !== 'undefined') {
        try {
          console.log('🔔 Cleaning up push subscriptions on logout...');
          
          // Import cleanup function dynamically to avoid SSR issues
          const { cleanupUserPushSubscriptions } = await import('../utils/webPush');
          const result = await cleanupUserPushSubscriptions();
          
          if (result.success) {
            console.log(`✅ Push subscriptions cleaned up successfully (${result.cleanedCount || 0} removed)`);
          } else {
            console.log('⚠️ Push subscription cleanup failed:', result.error);
          }
        } catch (pushError) {
          console.log('⚠️ Could not cleanup push subscriptions:', pushError);
          // Don't block logout if push cleanup fails
        }

        // Clear any stored data
        localStorage.removeItem('supabase.auth.token');
      }

      // Update auth state immediately before signOut
      setAuthState({
        user: null,
        isLoggedIn: false,
        loading: false,
        initialized: true
      });

      // Notify other tabs about logout
      notifyTabs({ type: 'SIGNED_OUT' });

      // Perform the signOut
      const { error } = await supabaseRef.current.auth.signOut({
        scope: 'local'
      });
      
      if (error) throw error;

      // Only redirect to home if we're not on a public route
      if (!isPublicRoute(router.pathname)) {
        await router.push('/');
      }

    } catch (error) {
      console.error('Logout error:', error);
      setError(AUTH_ERRORS.GENERIC_ERROR);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Manual session refresh function for UI-triggered refreshes
  const performSessionRefresh = async () => {
    console.log('Auth: Manually refreshing session');
    return refreshUserSession({ shouldNotifyTabs: true });
  };

  // Function to check if a user exists in the Supabase database
  const userExists = async (username) => {
    try {
      // Normalize username to lowercase and remove any whitespace
      const normalizedUsername = username.trim().toLowerCase();
      
      const { data, error } = await supabaseRef.current
        .from('users')
        .select('username, email, is_admin')
        .eq('username', normalizedUsername)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking if user exists:', error);
      }
      return data ? data : null;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return null;
    }
  };

  // Function to create a user in the Supabase database
  const createUser = async ({ username, email, password, gizmoId }) => {
    try {
      // Normalize username to lowercase and remove any whitespace
      const normalizedUsername = username.trim().toLowerCase();
      
      // Create auth user in Supabase
      const { data: authData, error: authError } = await supabaseRef.current.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      // Create user record with gizmoId
      const { data: userData, error: insertError } = await supabaseRef.current
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email.trim(),
            username: normalizedUsername,
            gizmo_id: gizmoId
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // Auto login
      const { data: signInData, error: signInError } = await supabaseRef.current.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) throw signInError;

      // Update auth state
      setAuthState({
        isLoggedIn: true,
        user: userData,
        loading: false,
        initialized: true
      });

      return true;
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  };

  // Update the storage listener to be more robust
  useEffect(() => {
    const handleStorageChange = async (event) => {
      // Check for both token removal and SIGNED_OUT message
      if ((event.key === 'supabase.auth.token' && !event.newValue) ||
          (event.key === 'auth-sync' && event.newValue === 'SIGNED_OUT')) {
        
        setAuthState({
          user: null,
          isLoggedIn: false,
          loading: false,
          initialized: true
        });

        // Only redirect to home if we're not on a public route
        if (!isPublicRoute(router.pathname) && isProtectedRoute(router.pathname)) {
          await router.push('/');
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, [router]);

  useEffect(() => {
    try {
      // Your auth initialization code
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error('Auth error:', error);
      }
    }
  }, [onError]);

  // Add effect to handle auth redirects and verification
  useEffect(() => {
    if (!mounted) return;

    const handleAuthRedirects = async () => {
      try {
        // Handle current URL parameters for auth redirects
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          const urlParams = new URLSearchParams(url.search);
          const hashParams = new URLSearchParams(url.hash.replace('#', '?'));
          
          // Check for verification tokens
          const hasRedirectToken = 
            urlParams.has('token') || 
            hashParams.has('access_token') || 
            hashParams.has('refresh_token') ||
            url.hash.includes('type=');
          
          // Handle verification types
          const isVerification = 
            urlParams.get('type') === 'email_change' || 
            urlParams.get('type') === 'signup' || 
            url.hash.includes('type=email_change') || 
            url.hash.includes('type=signup');

          // If redirect token on auth page, wait for processing
          if (hasRedirectToken && isVerification) {
            console.log('Auth: Detected verification redirect token');
            
            // Wait briefly for auth to process
            setTimeout(async () => {
              // Get current user and session after verification completes
              try {
                const { data } = await supabaseRef.current.auth.getUser();
                if (data?.user) {
                  console.log('Auth: Verified user found after redirect', data.user.email);
                  
                  // Determine verification type
                  const isEmailChange = 
                    urlParams.get('type') === 'email_change' || 
                    url.hash.includes('type=email_change');
                  
                  // Redirect to appropriate success page
                  const successPage = isEmailChange ? 
                    `/auth/verification-success?type=email_change&email=${data.user.email}` : 
                    '/auth/verification-success?type=signup';
                  
                  if (router.pathname !== '/auth/verification-success') {
                    await router.push(successPage);
                  }
                } else {
                  console.log('Auth: No user found after redirect token processing');
                }
              } catch (error) {
                console.error('Auth: Error handling verification redirect', error);
              }
            }, 1000);
          }
        }
      } catch (error) {
        console.error('Error handling auth redirects:', error);
      }
    };

    handleAuthRedirects();
  }, [mounted, router]);

  if (shouldShowLoading()) {
    return children;
  }

  // Return the context value
  const value = {
    isLoggedIn: authState.isLoggedIn,
    user: authState.user,
    loading: authState.loading || isRefreshing,
    initialized: authState.initialized,
    isLoading, 
    isRefreshing,
    error,
    login, 
    logout, 
    forceSessionReload,
    fetchUserData,
    userExists,
    createUser,
    supabase: supabaseRef.current,
    refreshUserData,
    refreshSession: (options) => refreshUserSession(options)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};