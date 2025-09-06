import { useState, useEffect, useRef } from 'react';

export const useMediaQuery = (query) => {
  const isMobileQuery = query.includes('max-width');
  
  // Initialize with SSR-safe default
  const [matches, setMatches] = useState(isMobileQuery);
  const mediaQueryRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  
  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return;
    
    // Create media query list
    mediaQueryRef.current = window.matchMedia(query);
    
    // Set initial value immediately to prevent hydration mismatch
    const initialValue = mediaQueryRef.current.matches;
    setMatches(initialValue);
    
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
  }, [query]);
  
  return matches;
}; 