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

  // Initialize Supabase client only on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    setMounted(true);
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!mounted) return;
    if (initRef.current) return;
    initRef.current = true;

    const getInitialSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabaseRef.current.auth.getSession();
        
        console.log('Auth: Initial session check', session); // Debug log

        if (sessionError) {
          console.error('Session error:', sessionError);
          return;
        }
        
        if (session?.user) {
          console.log('Auth: Found existing session, getting user data');
          const userData = await fetchUserData(session.user.email);
          
          if (userData) {
            console.log('Initial user data loaded:', userData);
            console.log('Admin status:', userData.isAdmin);
            
            setAuthState({
              isLoggedIn: true,
              user: userData,
              loading: false,
              initialized: true
            });

            // Only redirect to dashboard if we're on the home page
            if (router.pathname === '/') {
              await router.replace('/dashboard');
            }
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
  }, [mounted]);

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
            const { data: { session }, error } = await supabaseRef.current.auth.getSession();
            if (error || !session) {
              throw new Error(AUTH_ERRORS.SESSION_EXPIRED);
            }

            // Refresh session
            const { data: refreshData, error: refreshError } = await supabaseRef.current.auth.refreshSession();
            if (refreshError) throw refreshError;

            // Update user data if refresh successful
            if (refreshData.session) {
              const { data: userData } = await supabaseRef.current
                .from('users')
                .select('*')
                .eq('email', refreshData.session.user.email)
                .single();

              // Map is_admin to isAdmin for consistency
              const processedUserData = userData ? {
                ...userData,
                isAdmin: userData.is_admin
              } : null;

              console.log('Refreshed user data:', processedUserData);

              setAuthState({
                isLoggedIn: true,
                user: processedUserData,
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
    }
  }, [authState.isLoggedIn]);

  // Add effect to handle magic link authentication
  useEffect(() => {
    if (!mounted) return;

    const handleMagicLink = async () => {
      try {
        // Get the hash from the URL if it exists
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('Magic link detected, setting session...');
          
          // Set the session with the tokens
          const { data: { session }, error } = await supabaseRef.current.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) throw error;

          if (session?.user) {
            // Get user data
            const userData = await fetchUserData(session.user.email);
            
            if (userData) {
              setAuthState({
                isLoggedIn: true,
                user: userData,
                loading: false,
                initialized: true
              });

              // Clear the URL hash
              window.location.hash = '';
              
              // Redirect to dashboard only if on the homepage
              if (router.pathname === '/') {
                router.replace('/dashboard');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error handling magic link:', error);
        setError('Error logging in with magic link');
      }
    };

    handleMagicLink();
  }, [mounted]);

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
      const { data, error } = await supabaseRef.current
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
      
      // Map is_admin to isAdmin for consistency in the frontend
      if (data) {
        console.log('Raw user data from DB:', data);
        return {
          ...data,
          isAdmin: data.is_admin // Ensure is_admin is mapped to isAdmin
        };
      }
      
      return data;
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
      // Find user by username or email
      const { data: userData, error: userError } = await supabaseRef.current
        .from('users')
        .select('email')
        .or(`username.eq.${identifier.toLowerCase()},email.eq.${identifier.toLowerCase()}`)
        .single();

      if (userError || !userData?.email) {
        setError('User not found');
        return { success: false, message: 'User not found' };
      }

      try {
        // Sign in with Supabase using email
        const { data, error: signInError } = await supabaseRef.current.auth.signInWithPassword({
          email: userData.email,
          password
        });

        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            return { success: false, message: 'Incorrect password' };
          }
          throw signInError;
        }

        // Get full user data
        const { data: fullUserData, error: fullUserError } = await supabaseRef.current
          .from('users')
          .select('*')
          .eq('email', userData.email)
          .single();

        if (fullUserError) throw fullUserError;

        // Update auth state
        setAuthState({
          isLoggedIn: true,
          user: fullUserData,
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

  // Function to check if a user exists in the Supabase database
  const userExists = async (username) => {
    try {
      const lowerCaseUsername = username.toLowerCase();
      const { data, error } = await supabaseRef.current
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
  const createUser = async ({ username, email, password, gizmoId }) => {
    try {
      // Create auth user in Supabase
      const { data: authData, error: authError } = await supabaseRef.current.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // Create user record with gizmoId
      const { data: userData, error: insertError } = await supabaseRef.current
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            username: username.toLowerCase(),
            gizmo_id: gizmoId
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // Auto login
      const { data: signInData, error: signInError } = await supabaseRef.current.auth.signInWithPassword({
        email,
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

  if (shouldShowLoading()) {
    return (
      <div className="auth-loading-wrapper" suppressHydrationWarning>
        <LoadingScreen 
          type="auth" 
          message={isLoggingOut ? "Logging out..." : "Authenticating..."} 
        />
      </div>
    );
  }

  // Only provide Supabase client after mounting
  const value = {
    ...authState,
    supabase: supabaseRef.current,
    login,
    logout,
    userExists,
    createUser,
    fetchUserData,
    error,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};