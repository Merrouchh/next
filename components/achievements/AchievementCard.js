import Link from 'next/link';
import { FaLock, FaGift, FaGamepad, FaTrophy, FaMedal, FaStar, FaCrown, FaUserCircle, FaThumbsUp, FaMobile, FaClock } from 'react-icons/fa';
import styles from '../../styles/Awards.module.css';
import ReviewUploader from './ReviewUploader';

/**
 * Component for rendering a single achievement card
 */
const AchievementCard = ({ 
  achievement,
  isClaimingId,
  onClaimAchievement,
  supabase,
  userId,
  onReviewSuccess
}) => {
  // Get icon component based on name
  const getIconComponent = (iconName) => {
    switch (iconName) {
      case 'trophy': return <FaTrophy className={styles.awardIcon} />;
      case 'medal': return <FaMedal className={styles.awardIcon} />;
      case 'star': return <FaStar className={styles.awardIcon} />;
      case 'gamepad': return <FaGamepad className={styles.awardIcon} />;
      case 'crown': return <FaCrown className={styles.awardIcon} />;
      case 'user': return <FaUserCircle className={styles.awardIcon} />;
      case 'thumbsup': return <FaThumbsUp className={styles.awardIcon} />;
      case 'mobile': return <FaMobile className={styles.awardIcon} />;
      default: return <FaStar className={styles.awardIcon} />;
    }
  };

  return (
    <div 
      key={achievement.id} 
      className={`${styles.awardCard} ${
        achievement.claimed 
          ? styles.awardClaimed 
          : achievement.completed 
            ? styles.awardCompleted 
            : styles.awardLocked
      }`}
    >
      {achievement.claimed && (
        <div className={styles.claimedBadge}>
          <span>CLAIMED</span>
        </div>
      )}
      
      {achievement.completed && !achievement.claimed && (
        <div className={styles.completedBadge}>
          <span>COMPLETED</span>
        </div>
      )}

      {achievement.pending && (
        <div className={styles.pendingBadge}>
          <span>PENDING REVIEW</span>
        </div>
      )}
      
      <div className={styles.awardIconContainer}>
        {achievement.claimed || achievement.completed ? (
          getIconComponent(achievement.icon)
        ) : (
          <FaLock className={`${styles.awardIcon} ${styles.lockedIcon}`} />
        )}
      </div>
      
      <div className={styles.awardInfo}>
        <h3 className={styles.awardName}>
          {achievement.name}
          {achievement.id === 'achievement-collector' && !achievement.claimed && (
            <div className={styles.achievementRewardTag}>
              <FaClock /> 1H VIP
            </div>
          )}
        </h3>
        <p className={styles.awardDescription}>{achievement.description}</p>
        
        {/* Different UI states based on achievement status */}
        {achievement.claimed ? (
          <div className={styles.awardMeta}>
            <span className={styles.awardPoints}>+{achievement.points} points</span>
          </div>
        ) : achievement.completed ? (
          <button 
            className={`${styles.claimButton} ${achievement.id === 'achievement-collector' ? styles.vipClaimButton : ''}`}
            onClick={() => onClaimAchievement(achievement.id)}
            disabled={isClaimingId === achievement.id}
          >
            {isClaimingId === achievement.id ? (
              <span className={styles.claimingText}>Claiming...</span>
            ) : (
              <>
                <FaGift className={styles.claimIcon} />
                <span>CLAIM REWARD</span>
              </>
            )}
          </button>
        ) : achievement.pending ? (
          <div className={styles.pendingMessage}>
            <p>Your screenshot is being reviewed by an admin.</p>
          </div>
        ) : achievement.id === 'five-star-review' ? (
          <ReviewUploader
            supabase={supabase}
            userId={userId}
            onSuccess={onReviewSuccess}
          />
        ) : achievement.progress !== undefined ? (
          <div className={styles.progressContainer}>
            <div 
              className={styles.progressBar}
              style={{ width: `${(achievement.progress / achievement.max_progress) * 100}%` }}
            ></div>
            <span className={styles.progressText}>
              {achievement.progress} / {achievement.max_progress}
            </span>
          </div>
        ) : (
          <Link href={achievement.link || "#"} className={styles.achievementLink}>
            How to unlock <span className={styles.linkArrow}>→</span>
          </Link>
        )}
      </div>
    </div>
  );
};

export default AchievementCard; 