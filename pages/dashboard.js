import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import DynamicMeta from '../components/DynamicMeta';
import LoadingScreen from '../components/LoadingScreen';
import styles from '../styles/Dashboard.module.css';
import { AiOutlineDesktop, AiOutlineUser, AiOutlineClockCircle, AiOutlineTrophy, AiOutlineCamera, AiOutlineReload } from 'react-icons/ai';
import DashboardUserSearch from '../components/DashboardUserSearch';
import { 
  fetchActiveUserSessions, 
  fetchTopUsers, 
  fetchUserPoints,
  fetchUserTimeInfo,
  fetchUserBalanceWithDebt,
  fetchUserPicture,
  uploadUserPicture
} from '../utils/api';
import { toast } from 'react-hot-toast';


export async function getServerSideProps({ res }) {
  // Keep existing cache headers
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return {
    props: {
      metaData: {
        title: "Gaming Dashboard | Merrouch Gaming Center",
        description: "Access your gaming profile, check remaining time, view active sessions, and track your rewards. Manage your gaming experience at Merrouch Gaming Center.",
        image: "https://merrouchgaming.com/top.jpg",
        url: "https://merrouchgaming.com/dashboard",
        type: "website",
        noindex: true, // Prevent indexing of private dashboard
        openGraph: {
          title: "Gaming Dashboard | Merrouch Gaming Center",
          description: "Manage your gaming profile and track your gaming sessions at Merrouch Gaming Center.",
          images: [
            {
              url: "https://merrouchgaming.com/top.jpg",
              width: 1200,
              height: 630,
              alt: "Merrouch Gaming Dashboard"
            }
          ],
          type: "website"
        },
        twitter: {
          card: "summary_large_image",
          site: "@merrouchgaming",
          title: "Gaming Dashboard | Merrouch Gaming Center",
          description: "Your personal gaming hub at Merrouch Gaming Center.",
          image: "https://merrouchgaming.com/top.jpg"
        }
      }
    }
  };
}

// Add helper functions at the top
const formatSessionCount = (activeCount) => {
  const totalCapacity = 14;
  return `${activeCount}/${totalCapacity}`;
};

const getMedalEmoji = (index) => {
  switch (index) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return '';
  }
};

// Modify the Active Sessions Card component to remove unused router prop
const ActiveSessionsCard = ({ activeSessions, handleNavigation }) => (
  <div 
    className={`${styles.statCard} ${styles.smallCard}`} 
    role="button"
    onClick={handleNavigation('/avcomputers?from=dashboard')}
    style={{ cursor: 'pointer' }}
    aria-label="View active computers"
  >
    <div className={styles.statHeader}>
      <div className={styles.statIcon}>
        <AiOutlineDesktop size={24} />
      </div>
      <h3 id="active-sessions-section" className={styles.statTitle}>Active Sessions</h3>
    </div>
    <div className={styles.sessionStats}>
      <div className={styles.sessionNumber}>
        {Array.isArray(activeSessions) ? formatSessionCount(activeSessions.length) : '0/14'}
      </div>
      <div className={styles.sessionLabel}>
        Active {(Array.isArray(activeSessions) && activeSessions.length === 1) ? 'Session' : 'Sessions'}
      </div>
    </div>
  </div>
);

// Add TopUsersCard component
const TopUsersCard = ({ topUsers, handleNavigation }) => (
  <div 
    className={`${styles.statCard} ${styles.mediumCard}`}
    onClick={handleNavigation('/topusers')}
    role="button"
    style={{ cursor: 'pointer' }}
    aria-label="View top users"
  >
    <div className={styles.statHeader}>
      <div className={styles.statIcon}>
        <AiOutlineTrophy size={24} />
      </div>
      <h3 className={styles.statTitle}>Top Players</h3>
    </div>
    <ul className={styles.topUsersList}>
      {topUsers?.map((user, index) => (
        <li key={index} className={styles.topUserItem}>
          <span className={styles.topUserRank}>{index + 1}</span>
          <span className={styles.topUserName}>{user.name || user.username}</span>
          <span className={styles.topUserMedal}>{getMedalEmoji(index)}</span>
        </li>
      )) || (
        <li className={styles.noDataMessage}>No top players available</li>
      )}
    </ul>
  </div>
);

const RefreshCard = ({ onRefresh, isLoading }) => (
  <div className={`${styles.statCard} ${styles.smallCard}`}>
    <div className={styles.statHeader}>
      <div className={styles.statIcon}>
        <AiOutlineReload size={24} />
      </div>
      <h3 className={styles.statTitle}>Refresh Data</h3>
    </div>
    <button 
      onClick={onRefresh}
      disabled={isLoading}
      className={`${styles.refreshButton} ${isLoading ? styles.refreshing : ''}`}
      aria-label="Refresh dashboard data"
    >
      <AiOutlineReload size={20} />
      {isLoading ? 'Refreshing...' : 'Refresh'}
    </button>
  </div>
);

const Dashboard = ({ _initialClips, metaData }) => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [pageState, setPageState] = useState({
    loading: true,
    error: null,
    data: null
  });

  useEffect(() => {
    if (pageState.data) return;
    if (!user?.gizmo_id) return;

    const initialize = async () => {
      try {
        console.log('🚀 Starting actual data fetch...');

        const [
          activeSessions,
          topUsers,
          points,
          timeInfo,
          balanceInfo,
          userPicture
        ] = await Promise.all([
          fetchActiveUserSessions(),
          fetchTopUsers(5),
          fetchUserPoints(user.gizmo_id),
          fetchUserTimeInfo(user.gizmo_id),
          fetchUserBalanceWithDebt(user.gizmo_id),
          fetchUserPicture(user.gizmo_id)
        ]);

        console.log('✅ Data fetch completed successfully');

        setPageState({
          loading: false,
          error: null,
          data: {
            activeSessions,
            topUsers,
            userPoints: points?.points || 0,
            timeInfo,
            balanceInfo,
            userPicture,
            needsProfileSetup: false
          }
        });
      } catch (error) {
        console.error('❌ Dashboard initialization error:', error);
        setPageState({
          loading: false,
          error: error.message,
          data: null
        });
      }
    };

    initialize();
  }, [user?.gizmo_id, pageState.data]);

  // Show loading state when no data or during auth
  if (authLoading || !pageState.data) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.loadingState}>
          {pageState.error ? (
            <div className={styles.errorMessage}>
              <p>{pageState.error}</p>
              <button 
                onClick={() => window.location.reload()}
                className={styles.retryButton}
              >
                Retry
              </button>
            </div>
          ) : (
            <LoadingScreen message="Loading dashboard..." />
          )}
        </div>
      </ProtectedPageWrapper>
    );
  }

  // Show setup required state
  if (pageState.data?.needsProfileSetup) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.setupRequired}>
          <h2>Profile Setup Required</h2>
          <p>Please complete your profile setup to access the dashboard.</p>
          <button 
            onClick={() => router.push('/profile/setup')}
            className={styles.setupButton}
          >
            Complete Setup
          </button>
        </div>
      </ProtectedPageWrapper>
    );
  }

  const getPointsColor = (points) => {
    return points < 73 ? styles.lowPoints : styles.highPoints;
  };

  const formatDebt = (amount) => {
    if (amount === 0) {
      return (
        <span className={styles.positiveDebt}>
          All Paid
          <span role="img" aria-label="checkmark">✅</span>
        </span>
      );
    }
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    return (
      <span className={isNegative ? styles.negativeDebt : styles.positiveDebt}>
        {isNegative ? '-' : ''}{absAmount} DH
        {isNegative && <span role="img" aria-label="warning">⚠️</span>}
      </span>
    );
  };

  const handleNavigation = (path) => async (e) => {
    if (e) e.preventDefault();
    try {
      await router.push(path);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handlePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      // Set loading state
      setPageState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));

      const success = await uploadUserPicture(user.gizmo_id, file);

      if (success) {
        const newPicture = await fetchUserPicture(user.gizmo_id);
        setPageState(prev => ({
          ...prev,
          loading: false,
          data: {
            ...prev.data,
            userPicture: newPicture
          }
        }));
      } else {
        throw new Error('Failed to upload picture');
      }
    } catch (error) {
      console.error('Error uploading picture:', error);
      setPageState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to upload picture. Please try again.'
      }));
      // Show error to user
      alert('Failed to upload picture. Please try again.');
    }
  };

  const handleEditProfile = () => {
    router.push('/editprofile');
  };

  const handleRefresh = async () => {
    setPageState(prev => ({ ...prev, loading: true }));
    try {
      const [
        activeSessions,
        topUsers,
        points,
        timeInfo,
        balanceInfo,
        userPicture
      ] = await Promise.all([
        fetchActiveUserSessions(),
        fetchTopUsers(5),
        fetchUserPoints(user.gizmo_id),
        fetchUserTimeInfo(user.gizmo_id),
        fetchUserBalanceWithDebt(user.gizmo_id),
        fetchUserPicture(user.gizmo_id)
      ]);

      setPageState({
        loading: false,
        error: null,
        data: {
          ...pageState.data,
          activeSessions,
          topUsers,
          userPoints: points?.points || 0,
          timeInfo,
          balanceInfo,
          userPicture
        }
      });

      toast.success('Dashboard refreshed!', {
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #FFD700',
        },
        iconTheme: {
          primary: '#FFD700',
          secondary: '#333',
        },
      });
    } catch (error) {
      console.error('Refresh error:', error);
      setPageState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to refresh data'
      }));
      toast.error('Failed to refresh data', {
        position: 'top-right'
      });
    }
  };

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <main className={styles.dashboardMain}>
        <section className={styles.welcomeSection}>
          <div className={styles.welcomeContent}>
            <h1 className={styles.welcomeText}>Welcome back, {user?.username}!</h1>
            <p className={styles.welcomeSubtitle}>Here's what's happening at Merrouch Gaming</p>
            <DashboardUserSearch />
          </div>
        </section>

        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.largeCard}`}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineUser size={24} />
              </div>
              <h3 className={styles.statTitle}>Profile Info</h3>
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.userPictureContainer}>
                {pageState.loading ? (
                  <div className={styles.userPictureLoading}>
                    <div className={styles.spinner} />
                  </div>
                ) : pageState.data?.userPicture ? (
                  <img 
                    src={pageState.data.userPicture} 
                    alt={`${user?.username}'s profile picture`}
                    className={styles.userPicture}
                    onError={() => {
                      setPageState(prev => ({
                        ...prev,
                        data: {
                          ...prev.data,
                          userPicture: null
                        }
                      }));
                    }}
                  />
                ) : (
                  <div className={styles.userPicturePlaceholder}>
                    <AiOutlineUser size={72} />
                  </div>
                )}
                {!pageState.loading && (
                  <label className={styles.uploadButtonOverlay}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePictureUpload}
                      className={styles.hiddenInput}
                    />
                    <AiOutlineCamera className={styles.uploadIcon} />
                  </label>
                )}
              </div>
              
              <div className={styles.profileDetails}>
                <p>
                  <strong>Username:</strong>
                  <span>{user?.username || 'N/A'}</span>
                </p>
                <p>
                  <strong>Points:</strong>
                  <span className={pageState.data.userPoints !== null ? getPointsColor(pageState.data.userPoints) : ''}>
                    {pageState.data.userPoints ?? '0'}
                  </span>
                </p>
                {pageState.data.balanceInfo && (
                  <p className={`${styles.debtInfo} ${pageState.data.balanceInfo.rawBalance === 0 ? styles.allPaid : ''}`}>
                    <strong>Outstanding Balance:</strong>
                    {formatDebt(pageState.data.balanceInfo.rawBalance || 0)}
                  </p>
                )}
                <button 
                  onClick={handleEditProfile}
                  className={styles.editProfileRow}
                >
                  <strong>Profile Settings</strong>
                  <div className={styles.editBadge}>
                    <AiOutlineUser className={styles.buttonIcon} />
                    <span>Edit</span>
                  </div>
                </button>
                
              </div>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.mediumCard}`}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineClockCircle size={24} />
              </div>
              <h3 className={styles.statTitle}>Time Remaining</h3>
            </div>
            <div className={styles.timeInfoContainer}>
              {pageState.data.timeInfo && 
              Object.values(pageState.data.timeInfo).some(time => time.hours > 0 || time.minutes > 0) ? (
                // Show time info if user has any time
                Object.entries(pageState.data.timeInfo).map(([type, time]) => {
                  if (time?.hours > 0 || time?.minutes > 0) {
                    return (
                      <div key={type} className={styles.timePackage}>
                        <div className={styles.packageLabel}>{type.toUpperCase()}</div>
                        <div className={styles.packageTime}>
                          <span className={styles[`${type}Time`]}>
                            {time.hours}h {time.minutes}m
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })
              ) : (
                <div className={styles.noTimeContainer}>
                  <p className={styles.noTime}>No Time Remaining!</p>
                  <p className={styles.noTimeMessage}>
                    Your account needs to be recharged to continue gaming.
                  </p>
                  <button 
                    className={styles.rechargeButton}
                    onClick={() => router.push('/shop')}
                  >
                    Recharge Now
                  </button>
                </div>
              )}
            </div>
          </div>

          <TopUsersCard 
            topUsers={pageState.data.topUsers} 
            handleNavigation={handleNavigation}
          />

          <ActiveSessionsCard 
            activeSessions={pageState.data.activeSessions || []} 
            handleNavigation={handleNavigation}
          />

          <RefreshCard 
            onRefresh={handleRefresh}
            isLoading={pageState.loading}
          />
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default Dashboard;
