import React from 'react';
import styles from '../../styles/avcomputers.module.css';

export const ComputerBox = ({
  computer,
  isTopFloor,
  lastUpdate,
  highlightActive,
  onOpenLoginModal,
  isLoading,
  userAlreadyLoggedIn,
  userCurrentComputer,
  queueStatus,
  userInQueue,
  userIsNextForTop,
  userIsNextForBottom
}) => {
  // If component is in loading state, show a skeleton
  if (isLoading) {
    return (
      <div className={`${isTopFloor ? styles.vipPcBox : styles.pcSquare} ${styles.loadingComputer}`}>
        <div className={styles.loadingPulse}></div>
      </div>
    );
  }

  const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
    ? computer.timeLeft.split(' : ')
    : [0, 0];
  const hours = parseInt(timeParts[0]) || 0;
  const minutes = parseInt(timeParts[1]) || 0;
  const totalMinutes = hours * 60 + minutes;

  const boxClass = isTopFloor ? styles.vipPcBox : styles.pcSquare;
  const activeClass = computer.isActive
    ? totalMinutes < 60
      ? isTopFloor ? styles.orange : styles.warning
      : styles.active
    : styles.inactive;

  const lastUpdateTime = lastUpdate[computer.id];
  const isRecentlyUpdated = lastUpdateTime && Date.now() - lastUpdateTime < 1000;

  // Check if this is the computer the user is logged into
  const isUserCurrentComputer = userCurrentComputer && userCurrentComputer.hostId === computer.id;

  // Check if there are waiters for this computer type
  // Only show "Queue" if queue is active AND there are waiters for this specific zone
  // BUT if user is #1 in queue for this computer type, show "Login" instead
  const hasWaiters = queueStatus && queueStatus.is_active ? (() => {
    if (isTopFloor) {
      // For top computers: check if there are "any" or "top" waiters
      const anyWaiters = (queueStatus.any_queue_count || 0) > 0;
      const topWaiters = (queueStatus.top_queue_count || 0) > 0;
      return anyWaiters || topWaiters;
    } else {
      // For bottom computers: check if there are "any" or "bottom" waiters
      const anyWaiters = (queueStatus.any_queue_count || 0) > 0;
      const bottomWaiters = (queueStatus.bottom_queue_count || 0) > 0;
      return anyWaiters || bottomWaiters;
    }
  })() : false; // If queue is not active, no waiters

  // Check if user is #1 in queue for this computer type
  // This is a simplified check - the full eligibility is verified in handleOpenLoginModal
  const isUserNumberOne = !!userInQueue && (isTopFloor ? !!userIsNextForTop : !!userIsNextForBottom);

  // Show "Login" (blue) if: no waiters OR user is #1 in queue for this computer type
  // Show "Queue" (orange) if: there are waiters AND user is not #1
  const shouldShowQueue = hasWaiters && !isUserNumberOne;
  const buttonText = shouldShowQueue ? 'Queue' : 'Login';

  return (
    <div
      key={computer.id}
      className={`
        ${boxClass}
        ${activeClass}
        ${isRecentlyUpdated ? styles.updated : ''}
        ${highlightActive && computer.isActive ? styles.highlight : ''}
        ${isUserCurrentComputer ? styles.userCurrentComputer : ''}
      `}
    >
      {isUserCurrentComputer && (
        <div className={styles.currentUserBadge}>Your Session</div>
      )}
      <div className={styles.pcNumber}>
        PC {computer.number}
      </div>
      <div className={styles.statusText}>
        {computer.isActive
          ? `Active - Time Left: ${computer.timeLeft}`
          : 'No User'}
      </div>

      {/* Show login button only for available computers and if user is not already logged in elsewhere */}
      {!computer.isActive && !userAlreadyLoggedIn && (
        <button
          className={shouldShowQueue ? `${styles.loginButton} ${styles.queueButton}` : styles.loginButton}
          onClick={() => onOpenLoginModal({
            hostId: computer.id,
            type: isTopFloor ? 'Top' : 'Bottom',
            number: computer.number
          })}
        >
          {buttonText}
        </button>
      )}
    </div>
  );
};


