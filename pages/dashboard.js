import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/dashboard.module.css';
import { AiOutlineDesktop, AiOutlineUser, AiOutlineClockCircle, AiOutlineTrophy, AiOutlineCamera } from 'react-icons/ai';
import { MdPlayArrow, MdPerson } from 'react-icons/md';
import { 
  fetchActiveUserSessions, 
  fetchTopUsers, 
  fetchTopClipOfWeek,
  fetchGizmoId,
  fetchUserPoints,
  fetchUserTimeInfo,
  fetchUserBalanceWithDebt,
  fetchUserPicture,
  uploadUserPicture
} from '../utils/api';
import LoadingScreen from '../components/LoadingScreen';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import UserSearch from '../components/UserSearch';
import DynamicMeta from '../components/DynamicMeta';
import { createClient as createServerClient } from '../utils/supabase/server-props';

export async function getServerSideProps({ req, res }) {
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const supabase = createServerClient({ req, res });

  try {
    // Check session server-side
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      };
    }

    // Get user's clips for initial render
    const { data: userClips } = await supabase
      .from('clips')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(12);

    const metaData = {
      title: 'My Dashboard | Merrouch Gaming',
      description: 'Manage your gaming clips and profile on Merrouch Gaming.',
      url: 'https://merrouchgaming.com/dashboard',
      type: 'website',
      image: 'https://merrouchgaming.com/top.jpg'
    };

    return {
      props: {
        initialSession: session,
        initialClips: userClips || [],
        metaData
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
}

// Add helper function before ActiveSessionsCard
const formatSessionCount = (activeCount) => {
  const totalCapacity = 14;
  return `${activeCount}/${totalCapacity}`;
};

// Add this constant at the top of the file
const API_TIMEOUT = 10000; // 10 seconds timeout

// Add this helper function
const timeoutPromise = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), ms)
    )
  ]);
};

// Add this near the top of the file
const LoadingState = ({ error }) => (
  <div className={styles.loadingState}>
    {error ? (
      <div className={styles.errorMessage}>
        <p>{error}</p>
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
);

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

const Dashboard = ({ _initialClips, metaData }) => {
  const router = useRouter();
  const { isLoggedIn, user, supabase, loading } = useAuth();
  const [pageState, setPageState] = useState({
    loading: true,
    error: null,
    data: {
      activeSessions: [],
      topUsers: [],
      userPoints: null,
      timeInfo: null,
      balanceInfo: null,
      userPicture: null
    }
  });
  const [topClip, setTopClip] = useState(null);

  // Move topClip fetch into the main initialization effect
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      // Auth check
      if (!loading && !isLoggedIn) {
        router.replace('/');
        return;
      }

      // Only proceed if logged in and supabase is available
      if (isLoggedIn && user && supabase) {
        try {
          await initializePage();
          // Fetch top clip only if component is still mounted
          if (mounted) {
            const clip = await fetchTopClipOfWeek(supabase);
            setTopClip(clip);
          }
        } catch (error) {
          console.error('Error initializing dashboard:', error);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [loading, isLoggedIn, user, supabase]); // Include all dependencies

  const initializePage = useCallback(async () => {
    if (!user) return;

    let mounted = true;
    
    try {
      setPageState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));

      // First get the gizmo ID with timeout
      const gizmoIdPromise = timeoutPromise(
        fetchGizmoId(user.username),
        API_TIMEOUT
      );

      const { gizmoId } = await gizmoIdPromise;
      
      if (!gizmoId) {
        throw new Error('No Gizmo ID found');
      }

      // Fetch all data in parallel with timeouts
      const promises = [
        timeoutPromise(fetchActiveUserSessions(), API_TIMEOUT),
        timeoutPromise(fetchTopUsers(5), API_TIMEOUT),
        timeoutPromise(fetchUserPoints(gizmoId), API_TIMEOUT),
        timeoutPromise(fetchUserTimeInfo(gizmoId), API_TIMEOUT),
        timeoutPromise(fetchUserBalanceWithDebt(gizmoId), API_TIMEOUT),
        timeoutPromise(fetchUserPicture(gizmoId), API_TIMEOUT)
      ];

      // Use Promise.allSettled instead of Promise.all to handle partial failures
      const results = await Promise.allSettled(promises);
      
      const [
        sessionsResult,
        topUsersResult,
        pointsResult,
        timeInfoResult,
        balanceInfoResult,
        userPictureResult
      ] = results;

      if (mounted) {
        setPageState({
          loading: false,
          error: null,
          data: {
            activeSessions: sessionsResult.status === 'fulfilled' ? sessionsResult.value : [],
            topUsers: topUsersResult.status === 'fulfilled' ? topUsersResult.value : [],
            userPoints: pointsResult.status === 'fulfilled' ? pointsResult.value?.points || 0 : 0,
            timeInfo: timeInfoResult.status === 'fulfilled' ? timeInfoResult.value : null,
            balanceInfo: balanceInfoResult.status === 'fulfilled' ? balanceInfoResult.value : null,
            userPicture: userPictureResult.status === 'fulfilled' ? userPictureResult.value : null
          }
        });

        // Check if any critical data failed to load
        const criticalFailures = [sessionsResult, pointsResult, timeInfoResult]
          .filter(result => result.status === 'rejected');
        
        if (criticalFailures.length > 0) {
          console.error('Some critical data failed to load:', 
            criticalFailures.map(f => f.reason));
          setPageState(prev => ({
            ...prev,
            error: 'Some data failed to load. Please refresh the page.'
          }));
        }
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      if (mounted) {
        setPageState(prev => ({
          ...prev,
          loading: false,
          error: error.message === 'Request timed out' 
            ? 'Dashboard is taking too long to load. Please refresh.'
            : 'Failed to load dashboard data'
        }));
      }
    }

    return () => {
      mounted = false;
    };
  }, [user]);

  // Update loading check
  if (loading || pageState.loading) {
    return <LoadingState error={pageState.error} />;
  }

  // Add immediate return if not authenticated
  if (!isLoggedIn || !user) {
    return null; // Router will handle redirect
  }

  // Destructure page state for easier access
  const { topUsers, userPoints } = pageState.data;

  // Add this helper function at the top level of your component
  const getMedalEmoji = (index) => {
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return '';
    }
  };

  const getPointsColor = (points) => {
    return points <= 72 ? styles.lowPoints : styles.highPoints;
  };

  // Update button click handlers to prevent default and use async/await
  const handleNavigation = (path) => async (e) => {
    if (e) e.preventDefault();
    try {
      await router.push(path);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const formatDebt = (amount) => {
    if (amount === 0) {
      return <span className={styles.positiveDebt}>All Paid</span>;
    }
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    return (
      <span className={isNegative ? styles.negativeDebt : styles.positiveDebt}>
        {isNegative ? '-' : ''}{absAmount} DH
      </span>
    );
  };

  const handlePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      setPageState(prev => ({
        ...prev,
        loading: true
      }));

      const { gizmoId } = await fetchGizmoId(user.username);
      const success = await uploadUserPicture(gizmoId, file);

      if (success) {
        // Refresh the user picture
        const newPicture = await fetchUserPicture(gizmoId);
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
      alert('Failed to upload picture. Please try again.');
      setPageState(prev => ({
        ...prev,
        loading: false
      }));
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
          </div>
          <div className={styles.searchContainer}>
            <UserSearch />
          </div>
        </section>

        <div className={styles.statsGrid}>
          {/* Profile Card */}
          <div className={`${styles.statCard} ${styles.largeCard}`}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineUser size={24} />
              </div>
              <h3 className={styles.statTitle}>Profile Info</h3>
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.userPictureWrapper}>
                <div className={styles.userPictureContainer}>
                  {pageState.data.userPicture ? (
                    <img 
                      src={pageState.data.userPicture} 
                      alt={`${user?.username}'s profile picture`}
                      className={styles.userPicture}
                    />
                  ) : (
                    <div className={styles.userPicturePlaceholder}>
                      <AiOutlineUser size={72} />
                    </div>
                  )}
                </div>
                <label className={styles.uploadButton}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureUpload}
                    className={styles.hiddenInput}
                  />
                  <AiOutlineCamera size={24} />
                </label>
              </div>
              <p>
                <strong>Username:</strong>
                <span>{user?.username}</span>
              </p>
              <p>
                <strong>Email:</strong>
                <span>{user?.email}</span>
              </p>
              <p>
                <strong>Points:</strong>
                <span className={userPoints !== null ? getPointsColor(userPoints) : ''}>
                  {userPoints !== null ? userPoints : 'Loading...'}
                </span>
              </p>
              {pageState.data.balanceInfo && (
                <p className={styles.debtInfo}>
                  <strong>Outstanding Balance:</strong>
                  {formatDebt(pageState.data.balanceInfo.rawBalance)}
                </p>
              )}
              {user?.is_admin && (
                <p>
                  <strong>Role:</strong>
                  <span>Admin</span>
                </p>
              )}
            </div>
          </div>

          {/* Top Clip Card - Moved here */}
          <div className={`${styles.statCard} ${styles.mediumCard}`}>
            <div className={styles.statHeader}>
              <h3>Top Clip of the Week</h3>
            </div>
            
            {topClip ? (
              <div className={styles.topClipContainer}>
                <div 
                  className={styles.topClipWrapper}
                  onClick={() => router.push(`/clip/${topClip.id}`)}
                >
                  <div className={styles.topClipHeader}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/profile/${topClip.username}`);
                      }}
                      className={styles.userLink}
                    >
                      <MdPerson />
                      <span>{topClip.username}</span>
                    </button>
                    <span className={styles.likeCount}>
                      ❤️ {topClip.likes_count || 0}
                    </span>
                  </div>
                  
                  <div className={styles.videoThumbnail}>
                    <img 
                      src={topClip.thumbnailUrl} 
                      alt="Top clip thumbnail"
                      className={styles.thumbnail}
                    />
                    <div className={styles.playButton}>
                      <MdPlayArrow />
                    </div>
                  </div>
                  
                  <h4 className={styles.clipTitle}>
                    {topClip.title || 'Untitled Clip'}
                  </h4>
                </div>
              </div>
            ) : (
              <div className={styles.noClipMessage}>
                <p>No top clips yet this week!</p>
                <p>Be the first to share an amazing gaming moment.</p>
              </div>
            )}
          </div>

          {/* Time Remaining Card */}
          <div className={`${styles.statCard} ${styles.mediumCard}`} role="region" aria-labelledby="time-section">
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineClockCircle size={24} />
              </div>
              <h3 id="time-section" className={styles.statTitle}>Time Remaining</h3>
            </div>
            {pageState.data.timeInfo ? (
              <div className={styles.timeInfoContainer}>
                {(pageState.data.timeInfo.vip.hours > 0 || pageState.data.timeInfo.vip.minutes > 0) && (
                  <div className={styles.timePackage}>
                    <div className={styles.packageLabel}>VIP</div>
                    <div className={styles.packageTime}>
                      <span className={styles.vipTime}>
                        {pageState.data.timeInfo.vip.hours}h {pageState.data.timeInfo.vip.minutes}m
                      </span>
                    </div>
                  </div>
                )}
                {(pageState.data.timeInfo.normal.hours > 0 || pageState.data.timeInfo.normal.minutes > 0) && (
                  <div className={styles.timePackage}>
                    <div className={styles.packageLabel}>Normal</div>
                    <div className={styles.packageTime}>
                      <span className={styles.normalTime}>
                        {pageState.data.timeInfo.normal.hours}h {pageState.data.timeInfo.normal.minutes}m
                      </span>
                    </div>
                  </div>
                )}
                {(pageState.data.timeInfo.bonus.hours > 0 || pageState.data.timeInfo.bonus.minutes > 0) && (
                  <div className={styles.timePackage}>
                    <div className={styles.packageLabel}>Bonus</div>
                    <div className={styles.packageTime}>
                      <span className={styles.bonusTime}>
                        {pageState.data.timeInfo.bonus.hours}h {pageState.data.timeInfo.bonus.minutes}m
                      </span>
                    </div>
                  </div>
                )}
                {!pageState.data.timeInfo.vip.hours && 
                 !pageState.data.timeInfo.normal.hours && 
                 !pageState.data.timeInfo.bonus.hours && 
                 !pageState.data.timeInfo.vip.minutes && 
                 !pageState.data.timeInfo.normal.minutes && 
                 !pageState.data.timeInfo.bonus.minutes && (
                  <div className={styles.noTimeContainer}>
                    <p className={styles.noTime}>No Time Remaining!</p>
                    <p className={styles.noTimeMessage}>
                      Your account needs to be recharged to continue gaming.
                    </p>
                    <button 
                      className={styles.rechargeButton}
                      onClick={handleNavigation('/shop')}
                    >
                      Recharge Now
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.timeInfoLoading}>
                <p>Loading time information...</p>
              </div>
            )}
          </div>

          {/* Top Players Card */}
          <div 
            className={`${styles.statCard} ${styles.mediumCard}`} 
            role="button"
            tabIndex={0}
            data-clickable="true"
            onClick={handleNavigation('/topusers?from=dashboard')}
            onKeyDown={(e) => e.key === 'Enter' && handleNavigation('/topusers?from=dashboard')()}
            aria-label="View all top players"
          >
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineTrophy size={24} />
              </div>
              <h3 id="top-players-section" className={styles.statTitle}>Top Players</h3>
            </div>
            {pageState.loading ? (
              <p>Loading top players...</p>
            ) : pageState.error ? (
              <p>{pageState.error}</p>
            ) : topUsers.length === 0 ? (
              <p>No top players found</p>
            ) : (
              <ul className={styles.topUsersList}>
                {topUsers.map((user, index) => (
                  <li 
                    key={index} 
                    className={styles.topUserItem}
                  >
                    <span className={`${styles.topUserRank} ${
                      index === 0 ? styles.firstPlace :
                      index === 1 ? styles.secondPlace :
                      index === 2 ? styles.thirdPlace : ''
                    }`}>
                      {index + 1}
                    </span>
                    <span className={styles.topUserName}>
                      {user.name || user.username}
                    </span>
                    <span className={styles.topUserMedal}>
                      {getMedalEmoji(index)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active Sessions Card */}
          <ActiveSessionsCard 
            activeSessions={pageState.data.activeSessions} 
            handleNavigation={handleNavigation}
          />
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default Dashboard;
