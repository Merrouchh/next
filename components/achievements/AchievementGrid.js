import React from 'react';
import AchievementCard from './AchievementCard';
import styles from '../../styles/Awards.module.css';

/**
 * Grid component for displaying all achievement cards
 */
const AchievementGrid = ({ 
  achievements, 
  claimingId,
  onClaimAchievement,
  supabase,
  userId,
  onReviewSuccess
}) => {
  return (
    <div className={styles.awardsContainer}>
      <div className={styles.awardsGrid}>
        {achievements.map(achievement => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            isClaimingId={claimingId}
            onClaimAchievement={onClaimAchievement}
            supabase={supabase}
            userId={userId}
            onReviewSuccess={onReviewSuccess}
          />
        ))}
      </div>
    </div>
  );
};

export default AchievementGrid; 