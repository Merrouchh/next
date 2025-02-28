import { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  // Initialize with null to avoid hydration mismatch
  const [matches, setMatches] = useState(null);
  
  useEffect(() => {
    // Create the media query list
    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Create stable listener
    const listener = (e) => {
      setMatches(e.matches);
    };

    // Add listener
    mediaQuery.addListener(listener);
    
    // Cleanup
    return () => {
      mediaQuery.removeListener(listener);
    };
  }, [query]); // Only re-run if query changes

  return matches;
}; 