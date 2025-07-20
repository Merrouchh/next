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

export const getRecommendedPayment = (amount) => {
  if (amount <= 20) {
    return { 
      text: 'Full amount payment required',
      amount: amount,
      percent: 100
    };
  } else {
    // For all other debts, only require 20%
    const payment = Math.ceil(amount * 0.2); // 20%
    return { 
      text: 'At least 20% payment required',
      amount: payment,
      percent: 20
    };
  }
};

export const hasAnyTime = (timeInfo) => {
  return timeInfo?.total && (timeInfo.total.hours > 0 || timeInfo.total.minutes > 0);
};

export const createNavigationHandler = (router) => (path) => async (e) => {
  if (e) e.preventDefault();
  try {
    await router.push(path);
  } catch (error) {
    console.error('Navigation error:', error);
  }
};

export const shouldShowDebtCard = (balanceInfo) => {
  return balanceInfo && balanceInfo.rawBalance < 0;
};

export const getDebtAmount = (balanceInfo) => {
  return balanceInfo ? Math.abs(balanceInfo.rawBalance) : 0;
}; 