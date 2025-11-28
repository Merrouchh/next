import React from 'react';
import { useRouter } from 'next/router';
import { AiOutlineUser } from 'react-icons/ai';
import DashboardCard from './DashboardCard';
import ProfilePicture from '../shared/ProfilePicture';
import styles from '../../styles/Dashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ProfileInfoCard = React.memo(({ user, userPoints, balanceInfo }) => {
  const router = useRouter();

  const getPointsColor = (points) => {
    return points < 73 ? styles.lowPoints : styles.highPoints;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatDebt = (amount) => {
    if (amount === 0) {
      return (
        <span className={styles.positiveDebt}>
          All Paid
        </span>
      );
    }
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    return (
      <span className={isNegative ? styles.negativeDebt : styles.positiveDebt}>
        {isNegative ? '-' : ''}{absAmount} DH
      </span>
    );
  };

  const handleEditProfile = () => {
    router.push('/editprofile');
  };

  return (
    <DashboardCard 
      title="Profile Info"
      icon={<AiOutlineUser size={24} />}
      className={styles.largeCard}
    >
      {user?.isAdmin && <span className={styles.adminBadge}>Admin Account</span>}
      <div className={styles.profileInfo}>
        <div className={styles.userPictureContainer}>
          <ProfilePicture 
            userId={user?.gizmo_id} 
            username={user?.username}
            isOwner={true}
            size={150}
          />
        </div>
        
        <div className={styles.profileDetails}>
          <p>
            <strong>Username:</strong>
            <span>{user?.username || 'N/A'}</span>
          </p>
          <p>
            <strong>Points:</strong>
            <span className={userPoints !== null ? getPointsColor(userPoints) : ''}>
              {userPoints ?? '0'}
            </span>
          </p>
          {balanceInfo && (
            <p className={`${styles.debtInfo} ${balanceInfo.rawBalance === 0 ? styles.allPaid : ''}`}>
              <strong>Outstanding Balance:</strong>
              {formatDebt(balanceInfo.rawBalance || 0)}
            </p>
          )}
          <div className={styles.profileActions}>
            <button 
              onClick={handleEditProfile}
              className={sharedStyles.primaryButton}
            >
              <AiOutlineUser className={sharedStyles.buttonIcon} />
              <span>Edit Profile Settings</span>
            </button>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
});

ProfileInfoCard.displayName = 'ProfileInfoCard';

export default ProfileInfoCard; 