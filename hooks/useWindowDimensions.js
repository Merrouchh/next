import { useState, useEffect, useRef } from 'react';

export const useWindowDimensions = () => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });
  
  const debounceTimeoutRef = useRef(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      // Prevent excessive updates during resize
      if (isUpdatingRef.current) return;
      
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        isUpdatingRef.current = true;
        
        // Use requestAnimationFrame to prevent forced reflows
        requestAnimationFrame(() => {
          const newDimensions = {
            width: window.innerWidth,
            height: window.innerHeight
          };
          
          setDimensions(prevDimensions => {
            // Only update if dimensions actually changed
            if (prevDimensions.width !== newDimensions.width || 
                prevDimensions.height !== newDimensions.height) {
              return newDimensions;
            }
            return prevDimensions;
          });
          
          isUpdatingRef.current = false;
        });
      }, 100); // 100ms debounce
    };

    // Set initial dimensions
    requestAnimationFrame(() => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    });

    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      clearTimeout(debounceTimeoutRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return dimensions;
};

// Convenience hook for mobile detection
export const useIsMobile = (breakpoint = 768) => {
  const { width } = useWindowDimensions();
  return width <= breakpoint;
}; 