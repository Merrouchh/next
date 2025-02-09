import { useState, useEffect, useRef } from 'react';

export const useVideoVisibility = (options = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      setIsVisible(visible);
      
      if (visible && !hasBeenVisible) {
        setHasBeenVisible(true);
      }
    }, {
      threshold: options.threshold || 0.5,
      rootMargin: options.rootMargin || '0px'
    });

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [hasBeenVisible, options.threshold, options.rootMargin]);

  return { elementRef, isVisible, hasBeenVisible };
}; 