import React from 'react';
import styles from '../../styles/TopUsers.module.css';

const UserCard = React.memo(({ user, index, rank, rewardText }) => {
  const getPodiumClassName = () => {
    switch (index) {
      case 0: return styles.firstPlace;
      case 1: return styles.secondPlace;
      case 2: return styles.thirdPlace;
      default: return '';
    }
  };

  return (
    <div className={`${styles.userItem} ${index < 3 ? styles.podium : ''} ${getPodiumClassName()}`}>
      <span className={styles.rank}>{rank}</span>
      <input
        type="text"
        className={styles.userInput}
        value={user.name}
        readOnly
        tabIndex={-1}
        aria-label={`User ${user.name} in position ${index + 1}`}
      />
      <span className={styles.rewardText}>{rewardText}</span>
    </div>
  );
});

UserCard.displayName = 'UserCard';

export default UserCard; 