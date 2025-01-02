import { createContext, useState, useContext, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/router';
import { fetchGizmoId } from '../utils/api';

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

  // All useEffects should be after state declarations
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      await initAuth();
      if (mounted) {
        setAuthState(prev => ({ ...prev, initialized: true }));
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let isHandlingVisibility = false;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isHandlingVisibility) {
        isHandlingVisibility = true;
        try {
          // Clear any stuck loading states
          if (isLoggingOut) {
            setIsLoggingOut(false);
          }

          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error || !session) {
            setAuthState({
              user: null,
              isLoggedIn: false,
              loading: false,
              initialized: true
            });
            router.push('/');
            return;
          }

          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .single();

          if (!userData) {
            throw new Error('No user data found');
          }

          setAuthState({
            user: userData,
            isLoggedIn: true,
            loading: false,
            initialized: true
          });
        } catch (error) {
          console.error('Visibility change error:', error);
          setIsLoggingOut(false);
          setAuthState({
            user: null,
            isLoggedIn: false,
            loading: false,
            initialized: true
          });
          router.push('/');
        } finally {
          isHandlingVisibility = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [router]);

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
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      // Get user email and gizmo_id first
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

      if (error) throw error;

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
      setAuthState(prev => ({ ...prev, loading: false }));
      return false;
    }
  };

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      
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
    } finally {
      setIsLoggingOut(false);
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

  // Move broadcast channel effect after other effects
  useEffect(() => {
    let channel = null;
    let handleStorageChange = null; // Declare the handler outside

    if (typeof window !== 'undefined') {
      channel = new BroadcastChannel('auth-sync');
      
      // Define the handler
      handleStorageChange = async () => {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          setAuthState({
            user: null,
            isLoggedIn: false,
            loading: false,
            initialized: true
          });
          await router.push('/');
        }
      };

      // Add event listeners
      window.addEventListener('storage', handleStorageChange);
      
      channel.onmessage = async (event) => {
        if (event.data.type === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            isLoggedIn: false,
            loading: false,
            initialized: true
          });
          await router.push('/');
        }
      };
    }

    // Cleanup function
    return () => {
      if (handleStorageChange) {
        window.removeEventListener('storage', handleStorageChange);
      }
      if (channel) {
        channel.close();
      }
    };
  }, [router]);

  // Update visibility change handler
  useEffect(() => {
    let isHandlingVisibility = false;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isHandlingVisibility) {
        isHandlingVisibility = true;
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (!session && authState.isLoggedIn) {
            setAuthState(prev => ({
              ...prev,
              user: null,
              isLoggedIn: false,
              loading: false
            }));
            
            // Only redirect to home if not already there
            if (router.pathname !== '/') {
              // Optional: Show notification
              toast?.error('Session expired. Please login again.');
              await router.push('/');
            }
          }
        } catch (error) {
          console.error('Visibility change error:', error);
        } finally {
          isHandlingVisibility = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [router, authState.isLoggedIn]);

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

  return (
    <AuthContext.Provider 
      value={{ 
        isLoggedIn: authState.isLoggedIn,
        user: authState.user,
        loading: authState.loading || !authState.initialized,
        login,
        logout,
        userExists,
        createUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
