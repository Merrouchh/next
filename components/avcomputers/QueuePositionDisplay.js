import React from 'react';
import styles from '../../styles/avcomputers.module.css';

// Simple component to display user's position in their specific queue type
export const QueuePositionDisplay = React.memo(function QueuePositionDisplay({ userInQueue }) {
  if (!userInQueue) return null;

  const userPosition = userInQueue?.position;
  const userComputerType = userInQueue?.computer_type;

  const queueTypeLabel = userComputerType === 'any'
    ? 'any computer'
    : userComputerType === 'bottom'
      ? 'bottom floor computers'
      : 'top floor computers';

  const displayText = `Position ${userPosition} for ${queueTypeLabel}`;

  return (
    <span className={styles.positionText}>
      {displayText}
    </span>
  );
});


