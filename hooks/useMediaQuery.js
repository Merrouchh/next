import { useState, useEffect, useRef } from 'react';

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
  const mediaQueryRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  
  useEffect(() => {
    if (!isClient) return;
    
    // Create media query list
    mediaQueryRef.current = window.matchMedia(query);
    
    // Debounced handler to prevent excessive updates
    const debouncedHandler = (e) => {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        // Use requestAnimationFrame to prevent forced reflows
        requestAnimationFrame(() => {
          const newMatches = e.matches;
          setMatches(newMatches);
          
          // Store in sessionStorage for consistency
          try {
            sessionStorage.setItem(`mq-${query}`, String(newMatches));
          } catch (e) {
            // Ignore storage errors
          }
        });
      }, 50); // 50ms debounce
    };
    
    // Set initial value using requestAnimationFrame
    requestAnimationFrame(() => {
      const initialValue = mediaQueryRef.current.matches;
      setMatches(initialValue);
      
      try {
        sessionStorage.setItem(`mq-${query}`, String(initialValue));
      } catch (e) {
        // Ignore storage errors
      }
    });
    
    // Add listener with proper error handling
    try {
      mediaQueryRef.current.addEventListener('change', debouncedHandler);
    } catch (e) {
      console.warn('Error adding media query listener:', e);
    }
    
    return () => {
      clearTimeout(debounceTimeoutRef.current);
      if (mediaQueryRef.current) {
        try {
          mediaQueryRef.current.removeEventListener('change', debouncedHandler);
        } catch (e) {
          console.warn('Error removing media query listener:', e);
        }
      }
    };
  }, [query, isClient]);
  
  return matches;
}; 