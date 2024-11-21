import { createContext, useState, useContext, useEffect } from 'react';

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
  const [loading, setLoading] = useState(true); // Track if we're loading auth info

  // Effect to check if the user is logged in (by checking localStorage)
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');
    
    // Simulate async loading (you can remove the setTimeout after this)
    setTimeout(() => {
      if (storedUsername && storedUserId) {
        setIsLoggedIn(true); // If user info exists, mark as logged in
        setUsername(storedUsername); // Store username
      } else {
        setIsLoggedIn(false); // Otherwise, not logged in
      }
      setLoading(false); // Once the check is complete, set loading to false
    }, 1000); // Simulate an async check (remove this if unnecessary)
  }, []);

  // Method to log in (stores user data in localStorage)
  const logIn = (username, userId) => {
    localStorage.setItem('username', username);
    localStorage.setItem('userId', userId);
    setUsername(username);
    setIsLoggedIn(true);
  };

  // Method to log out (removes user data from localStorage)
  const logOut = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    setUsername('');
    setIsLoggedIn(false);
  };

  // Provide context values to the rest of the app
  return (
    <AuthContext.Provider value={{ isLoggedIn, logIn, logOut, username, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
