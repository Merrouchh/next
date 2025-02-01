import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/component';
import { useRouter } from 'next/router';
import { fetchGizmoId } from '../utils/api';
import LoadingScreen from '../components/LoadingScreen';
import { isPublicRoute, isProtectedRoute } from '../utils/routeConfig';

// Create context with default value
const AuthContext = createContext({
  isLoggedIn: false,
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  userExists: async () => {},
  createUser: async () => {},
  fetchUserData: async () => {}
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children, initialSession }) {
  const router = useRouter();
  const supabase = createClient();
  
  // Add session ref to track initial session
  const sessionRef = useRef(null);
  
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    user: null,
    loading: true,
    initialized: false
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [navigationTimeout, setNavigationTimeout] = useState(null);

  // Single state for tracking navigation
  const [navigationState, setNavigationState] = useState({
    isNavigating: false,
    lastNavigationTime: null,
    currentPath: null
  });

  // Add focus tracking state
  const [isPageFocused, setIsPageFocused] = useState(true);

  // Reset navigation state
  const resetNavigation = useCallback(() => {
    setNavigationState({
      isNavigating: false,
      lastNavigationTime: null,
      currentPath: null
    });
    setNavigationLoading(false);
  }, []);

  // Handle navigation events
  useEffect(() => {
    let timeoutId = null;

    const handleStart = (url) => {
      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      setNavigationState({
        isNavigating: true,
        lastNavigationTime: Date.now(),
        currentPath: url
      });
      setNavigationLoading(true);

      // Set a timeout to reset navigation state
      timeoutId = setTimeout(resetNavigation, 3000);
    };

    const handleComplete = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resetNavigation();
    };

    const handleError = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resetNavigation();
      setAuthState(prev => ({...prev, loading: false}));
    };

    // Handle tab visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // If we've been hidden for more than 3 seconds, reset navigation
        const timeSinceNavigation = navigationState.lastNavigationTime 
          ? Date.now() - navigationState.lastNavigationTime 
          : 0;
        
        if (timeSinceNavigation > 3000) {
          resetNavigation();
        }
      }
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, resetNavigation, navigationState.lastNavigationTime]);

  // Handle focus and visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsPageFocused(isVisible);
      
      if (isVisible) {
        // Reset loading states when page becomes visible
        setNavigationLoading(false);
        setNavigationState(prev => ({
          ...prev,
          isNavigating: false
        }));
        
        // Check auth state when returning to page
        if (authState.isLoggedIn) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && authState.isLoggedIn) {
              // Session expired while away - reset state
              setAuthState(prev => ({
                ...prev,
                isLoggedIn: false,
                loading: false
              }));
            }
          });
        }
      }
    };

    const handleFocus = () => {
      setIsPageFocused(true);
      // Reset loading states on focus
      setNavigationLoading(false);
      setNavigationState(prev => ({
        ...prev,
        isNavigating: false
      }));
    };

    const handleBlur = () => {
      setIsPageFocused(false);
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [authState.isLoggedIn, supabase.auth]);

  // Update shouldShowLoading to consider page focus
  const shouldShowLoading = () => {
    if (typeof window === 'undefined' || isPublicRoute(router.pathname)) {
      return false;
    }

    // Don't show loading screen when page is not focused
    if (!isPageFocused) {
      return false;
    }

    if (!authState.initialized || isLoggingOut) {
      return true;
    }

    // Check if navigation has been stuck
    if (navigationState.isNavigating) {
      const timeSinceNavigation = Date.now() - navigationState.lastNavigationTime;
      if (timeSinceNavigation > 3000) {
        resetNavigation();
        return false;
      }
      return true;
    }

    return isProtectedRoute(router.pathname) && !authState.isLoggedIn && authState.loading;
  };

  // Function to fetch user data
  const fetchUserData = async (identifier) => {
    if (!identifier) return null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`id, username, email, is_admin, gizmo_id, created_at`)
        .or(`username.eq.${identifier.toLowerCase()},email.eq.${identifier.toLowerCase()}`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - not necessarily an error for our use case
          return null;
        }
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Auth initialization and listener
  useEffect(() => {
    let mounted = true;
    let authSubscription = null;

    const initAuth = async () => {
      try {
        // First check session and store it
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          sessionRef.current = session;
        }

        // If no session, set initial state and return early
        if (!session) {
          if (mounted) {
            setAuthState({
              user: null,
              isLoggedIn: false,
              loading: false,
              initialized: true
            });
          }
          return;
        }

        // If we have a session, get user data
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          // Handle auth errors silently for public routes
          if (isPublicRoute(router.pathname)) {
            setAuthState({
              user: null,
              isLoggedIn: false,
              loading: false,
              initialized: true
            });
            return;
          }
          throw userError;
        }

        if (authUser && mounted) {
          const userData = await fetchUserData(authUser.email);
          if (userData) {
            setAuthState({
              user: userData,
              isLoggedIn: true,
              loading: false,
              initialized: true
            });
          }
        }

        // Set up auth state change listener with session check
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
          if (!mounted) return;

          if (event === 'SIGNED_OUT' || !_session) {
            sessionRef.current = null;
            setAuthState({
              user: null,
              isLoggedIn: false,
              loading: false,
              initialized: true
            });
            return;
          }

          // Only handle sign in if we don't have a session or it's a new session
          if ((event === 'SIGNED_IN' && (!sessionRef.current || sessionRef.current.access_token !== _session.access_token)) ||
              event === 'TOKEN_REFRESHED') {
            sessionRef.current = _session;
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
              const userData = await fetchUserData(currentUser.email);
              if (userData) {
                setAuthState({
                  user: userData,
                  isLoggedIn: true,
                  loading: false,
                  initialized: true
                });
              }
            }
          }
        });

        authSubscription = subscription;

      } catch (error) {
        // Only log error if it's not a session missing error
        if (!error.message?.includes('Auth session missing')) {
          console.error('Auth initialization error:', error);
        }
        
        if (mounted) {
          setAuthState({
            user: null,
            isLoggedIn: false,
            loading: false,
            initialized: true
          });
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      sessionRef.current = null;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [supabase, router.pathname]);

  useEffect(() => {
    let refreshTimer;

    const setupTokenRefresh = () => {
      if (authState.user) {
        // Refresh 5 minutes before token expires (assuming 1 hour expiry)
        const REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes
        
        refreshTimer = setInterval(async () => {
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.error('Token refresh error:', error);
              // Check if we still have a valid session
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                // Session is invalid, reset state
                setAuthState(prev => ({
                  ...prev,
                  isLoggedIn: false,
                  loading: false
                }));
                if (!isPublicRoute(router.pathname)) {
                  router.push('/');
                }
              }
            } else if (data.session) {
              // Session refreshed successfully
              console.log('Session refreshed successfully');
            }
          } catch (error) {
            console.error('Token refresh error:', error);
          }
        }, REFRESH_INTERVAL);
      }
    };

    setupTokenRefresh();

    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [authState.user, router.pathname]);

  // Add session recovery mechanism
  const login = async (username, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('email, gizmo_id')
        .eq('username', username.toLowerCase())
        .single();

      if (!userData?.email) {
        throw new Error('User not found');
      }

      // Fetch Gizmo ID and update user record if gizmo_id is not already set
      if (!userData.gizmo_id) {
        const { gizmoId } = await fetchGizmoId(username.toLowerCase());
        if (gizmoId) {
          await supabase
            .from('users')
            .update({ gizmo_id: gizmoId })
            .eq('username', username.toLowerCase());
        } else {
          console.error('Failed to fetch Gizmo ID');
        }
      }

      // Sign in with enhanced options
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password,
        options: {
          redirectTo: window.location.origin,
          persistSession: true,
          cookieOptions: {
            name: 'sb-auth-token',
            lifetime: 60 * 60 * 24 * 365, // 1 year
            domain: window.location.hostname,
            path: '/',
            sameSite: 'lax'
          }
        }
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          setError('Too many login attempts. Please try again later.');
        } else {
          setError(error.message);
        }
        return;
      }

      // Fetch user data after successful login
      const fullUserData = await fetchUserData(username.toLowerCase());
      if (fullUserData) {
        setAuthState({
          user: fullUserData,
          isLoggedIn: true,
          loading: false,
          initialized: true
        });

        // Only redirect to dashboard if this is an actual login attempt
        if (router.pathname === '/') {
          await router.push('/dashboard');
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred. Please try again.');
      setAuthState(prev => ({ ...prev, loading: false }));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoggingOut(true);

      // Clear any stored data first
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token');
      }

      // Update auth state immediately before signOut
      setAuthState({
        user: null,
        isLoggedIn: false,
        loading: false,
        initialized: true
      });

      // Perform the signOut
      const { error } = await supabase.auth.signOut({
        scope: 'local'
      });
      
      if (error) throw error;

      // Only redirect to home if we're not on a public route
      if (!isPublicRoute(router.pathname)) {
        await router.push('/');
      }

    } catch (error) {
      console.error('Logout error:', error);
      setError(error.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Function to check if a user exists in the Supabase database
  const userExists = async (username) => {
    try {
      const lowerCaseUsername = username.toLowerCase();
      const { data, error } = await supabase
        .from('users')
        .select('username, email, is_admin')
        .eq('username', lowerCaseUsername)
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
  const createUser = async (email, password, username) => {
    try {
      const lowerCaseUsername = username.toLowerCase();
      const { error: signUpError, data } = await supabase.auth.signUp({ email, password });
      
      if (!signUpError) {
        console.log('User signed up successfully:', data);
        if (data.user) {
          // First try to get the Gizmo ID
          let gizmoId = null;
          try {
            console.log('Fetching Gizmo ID for new user:', lowerCaseUsername);
            const gizmoResponse = await fetch(`/api/returngizmoid?username=${lowerCaseUsername}`);
            
            if (gizmoResponse.ok) {
              const gizmoData = await gizmoResponse.json();
              console.log('Gizmo ID fetched successfully:', gizmoData);
              gizmoId = gizmoData.gizmo_id;
            } else {
              console.error('Failed to fetch Gizmo ID for new user');
            }
          } catch (gizmoError) {
            console.error('Error fetching Gizmo ID for new user:', gizmoError);
          }

          // Insert user with Gizmo ID if available
          const { error: insertError } = await supabase
            .from('users')
            .insert([{ 
              id: data.user.id, 
              email, 
              username: lowerCaseUsername,
              gizmo_id: gizmoId // Will be null if fetch failed
            }]);

          if (!insertError) {
            console.log('User inserted into users table successfully');
            // Automatically log in the user
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (!signInError) {
              setAuthState(prev => ({
                ...prev,
                user: {
                  id: data.user.id,
                  username: lowerCaseUsername,
                  isAdmin: false,
                  email: email,
                  gizmo_id: gizmoId // Include Gizmo ID in user state
                },
                isLoggedIn: true,
                loading: false
              }));
              console.log('User logged in successfully with Gizmo ID:', gizmoId);
            } else {
              console.error('Error logging in user:', signInError);
            }
          } else {
            console.error('Error inserting user into users table:', insertError);
          }
        } else {
          console.error('User object is undefined after sign-up');
        }
      } else {
        console.error('Error signing up user:', signUpError);
      }
    } catch (error) {
      console.error('Error creating user:', error);
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

  // Simplified route protection logic
  useEffect(() => {
    const checkAuth = async () => {
      // Don't do anything while loading or for public routes
      if (authState.loading || isPublicRoute(router.pathname)) {
        return;
      }

      // Redirect to home if trying to access protected route while not logged in
      if (isProtectedRoute(router.pathname) && !authState.isLoggedIn) {
        await router.push('/');
      }
    };

    checkAuth();
  }, [authState.loading, authState.isLoggedIn, router.pathname]);

  // Clean up navigation timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
  }, [navigationTimeout]);

  if (shouldShowLoading()) {
    return <LoadingScreen 
      message={
        isLoggingOut ? "Logging out..." : 
        navigationState.isNavigating ? "Navigating..." : 
        "Loading..."
      } 
      type={typeof window !== 'undefined' ? 'auth' : undefined} 
    />;
  }

  return (
    <AuthContext.Provider 
      value={{ 
        isLoggedIn: authState.isLoggedIn,
        user: authState.user,
        loading: authState.loading || isLoading,
        supabase,
        login,
        logout,
        userExists,
        createUser,
        fetchUserData,
        error,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}