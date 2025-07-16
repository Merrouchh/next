import React from 'react';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';
import styles from '../../styles/TopUsers.module.css';

const Timer = React.memo(() => {
  const { timeLeft, currentMonth } = useCountdownTimer();
  
  return (
    <p className={styles.counterText}>
      {`Current Month: ${currentMonth} | Time Left Until Next Month: ${timeLeft}`}
    </p>
  );
});

Timer.displayName = 'Timer';

export default Timer; 