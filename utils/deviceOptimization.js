// Device Detection and Performance Optimization Utilities
// Specifically designed to handle performance issues on older iOS devices

/**
 * Detects if the current device is iOS (iPhone, iPad, iPod, or newer MacBooks with touch)
 * @returns {boolean} True if running on iOS device
 */
export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Detects if the current device is likely an older/slower device
 * Based on iOS version, memory, and processor indicators
 * @returns {boolean} True if device appears to be older/slower
 */
export const isOldDevice = () => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for old iOS versions (iOS 9-13 are considered old)
  const isOldIOS = /os\s[0-9]_|os\s1[0-3]_/.test(userAgent);
  
  // Check for low memory devices (less than 4GB RAM)
  const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  
  // Check for slow processors (less than 4 cores)
  const isSlowProcessor = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
  
  // Check for older device models in user agent
  const isOldDeviceModel = /iphone\s[1-6]|ipad[1-4]|ipod/.test(userAgent);
  
  // Check for slow connection
  const isSlowConnection = navigator.connection && (
    navigator.connection.effectiveType === '2g' || 
    navigator.connection.effectiveType === 'slow-2g' ||
    navigator.connection.downlink < 1.5
  );
  
  return isOldIOS || isLowMemory || isSlowProcessor || isOldDeviceModel || isSlowConnection;
};

/**
 * Detects if device has limited performance capabilities
 * More conservative check than isOldDevice
 * @returns {boolean} True if device has performance limitations
 */
export const hasLimitedPerformance = () => {
  if (typeof window === 'undefined') return false;
  
  // Check for very specific performance indicators
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 2;
  const verySlowProcessor = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 2;
  const verySlowConnection = navigator.connection && (
    navigator.connection.effectiveType === '2g' || 
    navigator.connection.effectiveType === 'slow-2g'
  );
  
  return lowMemory || verySlowProcessor || verySlowConnection;
};

/**
 * Performance-optimized navigation for older devices
 * Provides fallback mechanisms for navigation failures
 * @param {Object} router - Next.js router object
 * @param {string} path - Path to navigate to
 * @returns {Promise} Navigation promise
 */
export const safeNavigate = async (router, path) => {
  try {
    // For old devices, add a small delay to prevent race conditions
    if (isOldDevice()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await router.push(path);
  } catch (routerError) {
    console.log("Router failed, using window.location fallback");
    
    // Fallback to window.location for problematic devices
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }
};

/**
 * Creates optimized timeout values based on device performance
 * @param {number} baseTimeout - Base timeout in milliseconds
 * @returns {number} Adjusted timeout for device performance
 */
export const getOptimizedTimeout = (baseTimeout) => {
  if (isOldDevice()) {
    // Increase timeout by 50% for old devices
    return Math.floor(baseTimeout * 1.5);
  }
  
  if (hasLimitedPerformance()) {
    // Double timeout for very limited devices
    return baseTimeout * 2;
  }
  
  return baseTimeout;
};

/**
 * Debounced function creator optimized for device performance
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const createOptimizedDebounce = (func, wait) => {
  let timeout;
  const adjustedWait = getOptimizedTimeout(wait);
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, adjustedWait);
  };
};

/**
 * Throttled function creator optimized for device performance
 * @param {Function} func - Function to throttle
 * @param {number} limit - Throttle limit in milliseconds
 * @returns {Function} Throttled function
 */
export const createOptimizedThrottle = (func, limit) => {
  let inThrottle;
  const adjustedLimit = getOptimizedTimeout(limit);
  
  return function() {
    const args = arguments;
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, adjustedLimit);
    }
  };
};

/**
 * Optimized React markdown processing based on device capabilities
 * @param {string} text - Markdown text to process
 * @param {number} maxLength - Maximum length for truncation
 * @returns {string} Processed/truncated text
 */
export const optimizedMarkdownProcessing = (text, maxLength = 200) => {
  if (!text || text.length <= maxLength) return text;
  
  // For old/limited devices, strip markdown and use simple text
  if (isOldDevice() || hasLimitedPerformance()) {
    const simpleText = text
      .replace(/[*_#\[\]()]/g, '') // Remove markdown syntax
      .replace(/\n+/g, ' ')        // Replace line breaks with spaces
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();
    
    return simpleText.length > maxLength 
      ? simpleText.substring(0, maxLength) + '...' 
      : simpleText;
  }
  
  // For newer devices, use more sophisticated truncation
  const truncated = text.substring(0, maxLength);
  const breakPoints = [
    truncated.lastIndexOf('\n\n'),
    truncated.lastIndexOf('\n'),
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf(' '),
  ];
  
  const bestBreak = breakPoints
    .filter(point => point > maxLength * 0.6)
    .sort((a, b) => b - a)[0];
  
  if (bestBreak && bestBreak > maxLength * 0.6) {
    return text.substring(0, bestBreak + 1) + '...';
  }
  
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return text.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};

/**
 * Determines if animations should be disabled based on device performance
 * @returns {boolean} True if animations should be disabled
 */
export const shouldDisableAnimations = () => {
  // Check for user preference first
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) return true;
  }
  
  // Disable animations for old or limited performance devices
  return isOldDevice() || hasLimitedPerformance();
};

/**
 * Determines if real-time subscriptions should be enabled
 * @returns {boolean} True if real-time subscriptions should be enabled
 */
export const shouldEnableRealTimeSubscriptions = () => {
  // Disable real-time subscriptions for old devices to save resources
  return !isOldDevice() && !hasLimitedPerformance();
};

/**
 * Gets optimized image loading strategy based on device
 * @returns {string} Loading strategy ('lazy', 'eager', or 'auto')
 */
export const getOptimizedImageLoading = () => {
  if (hasLimitedPerformance()) {
    return 'lazy'; // Always lazy load for very limited devices
  }
  
  if (isOldDevice()) {
    return 'lazy'; // Lazy load for old devices
  }
  
  return 'auto'; // Let browser decide for newer devices
};

/**
 * Creates optimized fetch configuration based on device
 * @param {Object} baseConfig - Base fetch configuration
 * @returns {Object} Optimized fetch configuration
 */
export const createOptimizedFetchConfig = (baseConfig = {}) => {
  const config = { ...baseConfig };
  
  // For old devices, add longer timeouts and retry logic
  if (isOldDevice()) {
    config.timeout = getOptimizedTimeout(config.timeout || 10000);
    
    // Add keep-alive for better connection reuse
    config.headers = {
      ...config.headers,
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=5, max=1000'
    };
  }
  
  return config;
};

/**
 * Memory management utility to prevent memory leaks on old devices
 * @param {Function} cleanup - cleanup function to call
 * @returns {Function} Enhanced cleanup function
 */
export const createMemoryOptimizedCleanup = (cleanup) => {
  return () => {
    try {
      // Call original cleanup
      if (typeof cleanup === 'function') {
        cleanup();
      }
      
      // For old devices, suggest garbage collection if available
      if (isOldDevice() && typeof window !== 'undefined' && window.gc) {
        setTimeout(() => {
          try {
            window.gc();
          } catch (e) {
            // Ignore if gc is not available
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Error in memory optimized cleanup:', error);
    }
  };
};

/**
 * Performance monitoring utility for development
 * @param {string} operationName - Name of the operation being measured
 * @param {Function} operation - Operation to measure
 * @returns {Promise} Operation result with performance logging
 */
export const measurePerformance = async (operationName, operation) => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${operationName}: ${duration.toFixed(2)}ms`);
      
      // Warn about slow operations on old devices
      if (isOldDevice() && duration > 1000) {
        console.warn(`[Performance Warning] ${operationName} took ${duration.toFixed(2)}ms on old device`);
      }
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.error(`[Performance Error] ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
};

/**
 * Device-specific configuration object
 */
export const deviceConfig = {
  get isOld() { return isOldDevice(); },
  get isIOS() { return isIOS(); },
  get hasLimitedPerformance() { return hasLimitedPerformance(); },
  get shouldDisableAnimations() { return shouldDisableAnimations(); },
  get shouldEnableRealTime() { return shouldEnableRealTimeSubscriptions(); },
  get imageLoadingStrategy() { return getOptimizedImageLoading(); },
  
  // Optimized timeouts
  navigation: getOptimizedTimeout(isIOS() ? 3000 : 5000),
  api: getOptimizedTimeout(10000),
  debounce: getOptimizedTimeout(300),
  throttle: getOptimizedTimeout(100),
  
  // Feature flags
  features: {
    animations: !shouldDisableAnimations(),
    realTimeSubscriptions: shouldEnableRealTimeSubscriptions(),
    complexMarkdown: !isOldDevice(),
    imageOptimization: true,
    memoryOptimization: isOldDevice()
  }
};

export default {
  isIOS,
  isOldDevice,
  hasLimitedPerformance,
  safeNavigate,
  getOptimizedTimeout,
  createOptimizedDebounce,
  createOptimizedThrottle,
  optimizedMarkdownProcessing,
  shouldDisableAnimations,
  shouldEnableRealTimeSubscriptions,
  getOptimizedImageLoading,
  createOptimizedFetchConfig,
  createMemoryOptimizedCleanup,
  measurePerformance,
  deviceConfig
}; 