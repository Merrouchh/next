import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/component';
import { useRouter } from 'next/router';
import { fetchGizmoId } from '../utils/api';
import LoadingScreen from '../components/LoadingScreen';
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

export function AuthProvider({ children }) {
  const router = useRouter();
  const supabase = createClient();
  const initTimeoutRef = useRef(null);
  const refreshTimerRef = useRef(null);
  
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

  // Session check function
  const checkSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
  }, [authState.isLoggedIn]);

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

  // Initialize auth
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Parallel fetch of session and user data
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session } } = await sessionPromise;

        if (!mounted) return;

        if (!session?.user) {
          setAuthState({
            isLoggedIn: false,
            user: null,
            loading: false,
            initialized: true
          });
          return;
        }

        // Fetch user data if we have a session
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (!mounted) return;

        setAuthState({
          isLoggedIn: true,
          user: userData || null,
          loading: false,
          initialized: true
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setAuthState({
            isLoggedIn: false,
            user: null,
            loading: false,
            initialized: true
          });
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  // Session refresh logic
  useEffect(() => {
    const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes refresh interval
    
    const refreshSession = async () => {
      setIsRefreshing(true);
      try {
        let retryCount = 0;
        const maxRetries = 3;
        
        const attemptRefresh = async () => {
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
              throw new Error(AUTH_ERRORS.SESSION_EXPIRED);
            }

            // Refresh session
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) throw refreshError;

            // Update user data if refresh successful
            if (refreshData.session) {
              const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('email', refreshData.session.user.email)
                .single();

              setAuthState({
                isLoggedIn: true,
                user: userData || null,
                loading: false,
                initialized: true
              });
            }
          } catch (error) {
            if (retryCount < maxRetries) {
              retryCount++;
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
              return attemptRefresh();
            }
            throw error;
          }
        };

        await attemptRefresh();
      } finally {
        setIsRefreshing(false);
      }
    };

    // Set up refresh interval when logged in
    if (authState.isLoggedIn) {
      refreshSession();
      refreshTimerRef.current = setInterval(refreshSession, REFRESH_INTERVAL);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [authState.isLoggedIn]);

  // Simplified loading check
  const shouldShowLoading = () => {
    if (typeof window === 'undefined' || isPublicRoute(router.pathname)) {
      return false;
    }

    if (!authState.initialized || isLoggingOut) {
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

  // Update login function
  const login = async (username, password) => {
    setIsLoading(true);
    setError(null);

    try {
      // Find user by username
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('username', username.toLowerCase())
        .single();

      if (userError || !userData?.email) {
        setError(AUTH_ERRORS.USER_NOT_FOUND);
        return false;
      }

      // Sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password
      });

      if (signInError) throw signInError;

      // Get full user data
      const { data: fullUserData, error: fullUserError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userData.email)
        .single();

      if (fullUserError) throw fullUserError;

      // First update auth state
      setAuthState({
        isLoggedIn: true,
        user: fullUserData,
        loading: false,
        initialized: true
      });

      // Then redirect to dashboard
      // We do this after state update because ProtectedPageWrapper
      // needs to see the logged-in state before the redirect
      await router.replace('/dashboard');

      console.log('Login successful');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setError(
        error.message.includes('Invalid login credentials') ? AUTH_ERRORS.INVALID_PASSWORD :
        error.message.includes('rate limit') ? AUTH_ERRORS.RATE_LIMIT :
        AUTH_ERRORS.GENERIC_ERROR
      );
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
      setError(AUTH_ERRORS.GENERIC_ERROR);
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

  if (shouldShowLoading()) {
    return <LoadingScreen 
      message={isLoggingOut ? "Logging out..." : "Loading..."} 
      type={typeof window !== 'undefined' ? 'auth' : undefined} 
    />;
  }

  return (
    <AuthContext.Provider 
      value={{
        ...authState,
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