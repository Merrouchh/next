import { useState, useEffect, useCallback } from 'react';

export const useCountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState('');
  const [currentMonth, setCurrentMonth] = useState('');

  const updateTimer = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const nextMonth = new Date(year, month + 1, 1, 0, 0, 0);
    const timeDiff = nextMonth - now;

    if (timeDiff <= 0) {
      setTimeLeft('0d 0h 0m 0s');
      return;
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);

    // Update month name only if it changed
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthName = monthNames[month];
    setCurrentMonth(prev => prev !== currentMonthName ? currentMonthName : prev);
  }, []);

  useEffect(() => {
    updateTimer(); // Initial update
    
    // Set up interval for regular updates
    const interval = setInterval(updateTimer, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [updateTimer]);

  return { timeLeft, currentMonth };
}; 