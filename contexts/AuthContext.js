import { createContext, useState, useContext, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

const AuthContext = createContext(null);
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : null
  }
});

// Custom hook for using auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch user data from Supabase
  const fetchUserData = async (authUser) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, username, is_admin, email, gizmo_id') // Added gizmo_id here
        .eq('id', authUser.id)
        .single();

      if (error) throw error;

      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Effect to check if the user is logged in (by checking Supabase)
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          const userData = await fetchUserData(authUser);
          if (userData) {
            setUser({
              id: userData.id,
              username: userData.username,
              isAdmin: userData.is_admin,
              email: userData.email,
              gizmo_id: userData.gizmo_id // Added this line
            });
            setIsLoggedIn(true);
            console.log('User data loaded:', userData);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsLoggedIn(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const userData = await fetchUserData(session.user);
        if (userData) {
          setUser({
            id: userData.id,
            username: userData.username,
            isAdmin: userData.is_admin,
            email: userData.email,
            gizmo_id: userData.gizmo_id // Added this line
          });
          setIsLoggedIn(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoggedIn(false);
        console.log('User signed out');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (username, password) => {
    try {
      const lowerCaseUsername = username.toLowerCase();
      console.log('Starting login process for:', lowerCaseUsername);
      
      // First get user data from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', lowerCaseUsername)
        .single();

      if (userError || !userData) {
        console.error('User not found:', userError);
        return false;
      }

      // Login with Supabase auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password
      });

      if (signInError) {
        console.error('Sign-in error:', signInError);
        return false;
      }

      // Only fetch Gizmo ID if it doesn't exist
      if (!userData.gizmo_id) {
        try {
          console.log('No existing Gizmo ID, fetching for:', lowerCaseUsername);
          const gizmoResponse = await fetch(`/api/returngizmoid?username=${lowerCaseUsername}`);
          
          if (!gizmoResponse.ok) {
            const errorData = await gizmoResponse.json();
            console.error('Failed to fetch Gizmo ID:', {
              status: gizmoResponse.status,
              data: errorData
            });
          } else {
            const gizmoData = await gizmoResponse.json();
            console.log('Gizmo ID fetched successfully:', gizmoData);
            userData.gizmo_id = gizmoData.gizmo_id;
          }
        } catch (gizmoError) {
          console.error('Error in Gizmo ID fetch:', gizmoError);
        }
      } else {
        console.log('Using existing Gizmo ID:', userData.gizmo_id);
      }

      setUser({
        id: userData.id,
        username: userData.username,
        isAdmin: userData.is_admin,
        email: userData.email,
        gizmo_id: userData.gizmo_id || null // Ensure gizmo_id is never undefined
      });
      
      setIsLoggedIn(true);
      console.log('Login successful with complete user data:', userData);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      // Clear state on error
      setUser(null);
      setIsLoggedIn(false);
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      console.log('Starting logout process...');
      
      // First clear all states
      setUser(null);
      setIsLoggedIn(false);
      setLoading(true);

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear any local storage data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token');
      }

      console.log('Logged out successfully');
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Force clean state even on error
      setUser(null);
      setIsLoggedIn(false);
      setLoading(false);
      return false;
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
              setUser({
                id: data.user.id,
                username: lowerCaseUsername,
                isAdmin: false,
                email: email,
                gizmo_id: gizmoId // Include Gizmo ID in user state
              });
              setIsLoggedIn(true);
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

  const value = {
    isLoggedIn,
    user,
    loading,
    login,
    logout,
    userExists,
    createUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Export supabase client for use in other files
export { supabase };
