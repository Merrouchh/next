import { createContext, useState, useContext, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey, {
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a context for authentication
const AuthContext = createContext();

// Custom hook to access the authentication context
export function useAuth() {
  return useContext(AuthContext);
}

// AuthProvider component to wrap around your app and provide auth context
export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Track the login state
  const [username, setUsername] = useState(''); // Store the username
  const [isAdmin, setIsAdmin] = useState(false); // Track if the user is an admin
  const [loading, setLoading] = useState(true); // Track if we're loading auth info
  const [userId, setUserId] = useState(null); // Store the user ID

  // Effect to check if the user is logged in (by checking Supabase)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, username, is_admin')
          .eq('id', user.id)
          .single();
        if (!error) {
          setUserId(userData.id);
          setUsername(userData.username);
          setIsAdmin(userData.is_admin);
        }
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  // Method to log in (uses Supabase)
  const logIn = async (username, password) => {
    const user = await userExists(username);
    if (user) {
      const { error, data } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (!error) {
        setUsername(user.username);
        setIsAdmin(user.is_admin);
        setIsLoggedIn(true);
        console.log('User logged in successfully');
      } else {
        console.error('Error logging in user:', error);
      }
    } else {
      console.error('Username does not exist');
    }
  };

  // Method to log out (uses Supabase)
  const logOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUsername('');
      setIsAdmin(false);
      setIsLoggedIn(false);
    } else {
      console.error(error);
    }
  };

  // Method to sign up (registers user in Supabase)
  const signUp = async (email, password) => {
    const { error, user } = await supabase.auth.signUp({ email, password });
    if (!error) {
      setUsername(user.email);
      setIsLoggedIn(true);
    } else {
      console.error(error);
    }
  };

  // Method to check if a user exists in the Supabase database
  const userExists = async (username) => {
    const { data, error } = await supabase
      .from('users')
      .select('username, email, is_admin')
      .eq('username', username)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking if user exists:', error);
    }
    return data ? data : null;
  };

  // Method to create a user in the Supabase database
  const createUser = async (email, password, username) => {
    const { error: signUpError, data } = await supabase.auth.signUp({ email, password });
    if (!signUpError) {
      console.log('User signed up successfully:', data);
      if (data.user) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ id: data.user.id, email, username }]);
        if (!insertError) {
          console.log('User inserted into users table successfully');
          // Automatically log in the user
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (!signInError) {
            setUsername(username);
            setIsLoggedIn(true);
            console.log('User logged in successfully');
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
  };

  // Provide context values to the rest of the app
  return (
    <AuthContext.Provider value={{ isLoggedIn, logIn, logOut, signUp, userExists, createUser, username, isAdmin, loading, userId }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
