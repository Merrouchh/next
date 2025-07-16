// Memoized utility functions for topusers page

// Cache podium icons to avoid repeated calculations
const PODIUM_ICONS = {
  0: '🥇',
  1: '🥈',
  2: '🥉'
};

// Cache reward texts to avoid repeated calculations
const REWARD_TEXTS = {
  0: 'Win 2 hours',
  1: 'Win 1.5 hours',
  2: 'Win 1 hour'
};

export const getPodiumIcon = (index) => {
  return PODIUM_ICONS[index] || (index + 1);
};

export const getRewardText = (index) => {
  return REWARD_TEXTS[index] || 'Win 30 minutes';
};

// Memoize user data processing
export const processUserData = (users) => {
  return users.map((user, index) => ({
    ...user,
    rank: getPodiumIcon(index),
    rewardText: getRewardText(index),
    index
  }));
};

// Performance monitoring utilities
export const withPerformanceMonitoring = (fn, label) => {
  return (...args) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${label} took ${end - start} milliseconds`);
    }
    
    return result;
  };
};

// Debounce utility for performance optimization
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}; 