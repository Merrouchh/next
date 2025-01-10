import { createContext, useState, useContext, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/router';
import { fetchGizmoId } from '../utils/api';
import LoadingScreen from '../components/LoadingScreen';

// Create context with default value
const AuthContext = createContext({
  isLoggedIn: false,
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  userExists: async () => {},
  createUser: async () => {}
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const supabase = createClient();
  
  // Move all useState declarations to the top
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    user: null,
    loading: true,
    initialized: false
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutTimeout, setLogoutTimeout] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // All useEffects should be after state declarations
  useEffect(() => {
    let mounted = true;
    let isHandlingVisibility = false;

    const checkAuth = async () => {
      if (!isHandlingVisibility) {
        isHandlingVisibility = true;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session && authState.isLoggedIn) {
            setAuthState({
              user: null,
              isLoggedIn: false,
              loading: false,
              initialized: true
            });
            
            if (router.pathname !== '/') {
              await router.push('/');
            }
          }
        } catch (error) {
          console.error('Auth check error:', error);
        } finally {
          isHandlingVisibility = false;
        }
      }
    };

    document.addEventListener('visibilitychange', checkAuth);
    window.addEventListener('focus', checkAuth);

    const initializeAuth = async () => {
      await initAuth();
      if (mounted) {
        setAuthState(prev => ({ ...prev, initialized: true }));
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', checkAuth);
      window.removeEventListener('focus', checkAuth);
    };
  }, [router, authState.isLoggedIn]);

  useEffect(() => {
    let refreshTimer;

    const setupTokenRefresh = () => {
      if (authState.user) {
        // Refresh token 5 minutes before expiry
        refreshTimer = setInterval(async () => {
          try {
            const { error } = await supabase.auth.refreshSession();
            if (error) throw error;
          } catch (error) {
            console.error('Token refresh error:', error);
          }
        }, 55 * 60 * 1000); // 55 minutes
      }
    };

    setupTokenRefresh();

    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [authState.user]);

  useEffect(() => {
    return () => {
      if (logoutTimeout) {
        clearTimeout(logoutTimeout);
      }
    };
  }, [logoutTimeout]);

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

      // Get full user data
      const { data: fullUserData } = await supabase
        .from('users')
        .select('*')
        .eq('email', userData.email)
        .single();

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
      setAuthState(prev => ({
        ...prev,
        loading: true  // Set loading to true during logout
      }));
      
      // Sign out from Supabase first
      await supabase.auth.signOut({ scope: 'global' });

      // Clear storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Update state
      setAuthState({
        user: null,
        isLoggedIn: false,
        loading: false,
        initialized: true
      });

      // Use router instead of window.location
      await router.push('/');
      
    } catch (error) {
      console.error('Logout error:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false
      }));
    }
  };

  // Update fetchUserData to use username and be more resilient
  const fetchUserData = async (username) => {
    if (!username) return null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          username,
          email,
          is_admin,
          gizmo_id,
          created_at
        `)
        .eq('username', username.toLowerCase())
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
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

  // Remove duplicate broadcast channel effect and merge storage listeners
  useEffect(() => {
    let channel = null;
    let handleStorageChange = null; // Declare outside to be accessible in cleanup
    
    if (typeof window !== 'undefined') {
      channel = new BroadcastChannel('auth-sync');
      
      // Define the handler
      handleStorageChange = async () => {
        const authCookie = document.cookie.split(';').some((item) => item.trim().startsWith('auth='));
        const storageToken = localStorage.getItem('supabase.auth.token');
        const session = await supabase.auth.getSession();
        
        if (!authCookie || !storageToken || !session.data.session) {
          setAuthState({
            user: null,
            isLoggedIn: false,
            loading: false,
            initialized: true
          });
          await router.push('/');
        }
      };

      window.addEventListener('storage', handleStorageChange);
      
      channel.onmessage = async (event) => {
        if (event.data.type === 'SIGNED_OUT') {
          await handleStorageChange();
        }
      };
    }

    return () => {
      if (channel) {
        if (handleStorageChange) { // Check if handler exists before removing
          window.removeEventListener('storage', handleStorageChange);
        }
        channel.close();
      }
    };
  }, [router]);

  // Update initAuth function
  const initAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAuthState(prev => ({
          ...prev,
          user: null,
          isLoggedIn: false,
          loading: false,
          initialized: true
        }));
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (userData) {
        setAuthState({
          user: userData,
          isLoggedIn: true,
          loading: false,
          initialized: true
        });

        // Only redirect to dashboard from home page
        if (router.pathname === '/') {
          await router.replace('/dashboard');
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState({
        user: null,
        isLoggedIn: false,
        loading: false,
        initialized: true
      });
    }
  };

  // Helper function to safely check localStorage
  const hasAuthToken = () => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('supabase.auth.token');
    }
    return false;
  };

  // Only show loading screen during initial authentication and when not already logged in
  if (!authState.initialized && !authState.isLoggedIn && !hasAuthToken()) {
    return <LoadingScreen message="Authenticating..." type="auth" />;
  }

  return (
    <AuthContext.Provider 
      value={{ 
        isLoggedIn: authState.isLoggedIn,
        user: authState.user,
        loading: authState.loading && !authState.isLoggedIn && !hasAuthToken(), // Only show loading when not logged in and no token exists
        login,
        logout,
        userExists,
        createUser,
        error,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
