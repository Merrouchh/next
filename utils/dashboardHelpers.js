/**
 * Dashboard utility functions
 */

export const formatSessionCount = (activeCount) => {
  const totalCapacity = 14;
  return `${activeCount}/${totalCapacity}`;
};

export const getMedalEmoji = (index) => {
  switch (index) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return '';
  }
};

export const getPointsColor = (points) => {
  return points < 73 ? 'lowPoints' : 'highPoints';
};

export const formatDebt = (amount) => {
  if (amount === 0) {
    return {
      text: 'All Paid',
      emoji: '✅',
      className: 'positiveDebt'
    };
  }
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  return {
    text: `${isNegative ? '-' : ''}${absAmount} DH`,
    emoji: isNegative ? '⚠️' : '',
    className: isNegative ? 'negativeDebt' : 'positiveDebt'
  };
};

export const hasAnyTime = (timeInfo) => {
  return timeInfo?.total && (timeInfo.total.hours > 0 || timeInfo.total.minutes > 0);
};

// Smart time formatter that only shows relevant units
export const formatTimeRemaining = (hours, minutes) => {
  // If no time at all
  if (hours === 0 && minutes === 0) {
    return null;
  }
  
  // If only minutes (less than 1 hour)
  if (hours === 0 && minutes > 0) {
    return `${minutes}m`;
  }
  
  // If hours and minutes
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  // If only hours (exact hours, no minutes)
  if (hours > 0 && minutes === 0) {
    return `${hours}h`;
  }
  
  return null;
};

export const createNavigationHandler = (router) => (path) => async (e) => {
  if (e) e.preventDefault();
  try {
    await router.push(path);
  } catch (error) {
    console.error('Navigation error:', error);
  }
}; 