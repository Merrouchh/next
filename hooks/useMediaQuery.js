import { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  // Check if we're in the browser
  const isClient = typeof window === 'object';
  const isMobileQuery = query.includes('max-width');
  
  // Function to get stored value or compute it
  const getStoredOrComputedValue = () => {
    if (!isClient) return isMobileQuery; // Default for SSR
    
    try {
      // Try to get from sessionStorage first for consistent experience during navigation
      const stored = sessionStorage.getItem(`mq-${query}`);
      if (stored !== null) return stored === 'true';
    } catch (e) {
      // Ignore storage errors
    }
    
    // Compute from matchMedia
    return window.matchMedia(query).matches;
  };
  
  // Initialize with computed/stored value
  const [matches, setMatches] = useState(getStoredOrComputedValue);
  
  useEffect(() => {
    if (!isClient) return;
    
    // Create the media query list
    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    const initialValue = mediaQuery.matches;
    setMatches(initialValue);
    
    // Store in sessionStorage for consistent experience during navigation
    try {
      sessionStorage.setItem(`mq-${query}`, initialValue.toString());
    } catch (e) {
      // Ignore storage errors
    }

    // Create stable listener
    const handleChange = (event) => {
      setMatches(event.matches);
      // Update stored value
      try {
        sessionStorage.setItem(`mq-${query}`, event.matches.toString());
      } catch (e) {
        // Ignore storage errors
      }
    };

    // Add listener (using addEventListener for better compatibility)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }
    
    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query, isClient]); // Re-run if query changes or client state changes

  return matches;
}; 