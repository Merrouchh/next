import { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/dashboard.module.css';
import { AiOutlineDesktop, AiOutlineShop, AiOutlineUser, AiOutlineTrophy, AiOutlineWechat, AiOutlineReload } from 'react-icons/ai';
import NotificationButton from '../components/NotificationButton';
import { fetchActiveUserSessions, fetchTopUsers, fetchUserPoints } from '../utils/api';

const Dashboard = () => {
  const { isLoggedIn, user, loading } = useAuth();
  const [status, setStatus] = useState('');
  const [activeSessions, setActiveSessions] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [error, setError] = useState(null);
  const [userPoints, setUserPoints] = useState(null);
  const [userAuth, setUserAuth] = useState(null);
  const router = useRouter();

  // Check if user is admin
  const isAdmin = user?.isAdmin || false;

  useEffect(() => {
    console.log('Dashboard useEffect triggered:', { isLoggedIn, user, loading });
    
    if (loading) {
      return; // Don't do anything while loading
    }

    if (!isLoggedIn || !user) {
      console.log('Not logged in or no user data, redirecting...');
      router.push('/');
      return;
    }

    async function fetchDashboardData() {
      console.log('Starting to fetch dashboard data...');
      
      try {
        const [sessions, users] = await Promise.all([
          fetchActiveUserSessions(),
          fetchTopUsers(5)
        ]);

        setActiveSessions(sessions);
        setTopUsers(users);
        setError(null);
      } catch (err) {
        console.error('Error in dashboard data fetch:', err);
        setError('No Users Found');
      }
    }

    fetchDashboardData();
  }, [isLoggedIn, user, loading, router]);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(subscription => {
              const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BI77cEBaJDS7BT_bpo8zt7jjIdZhXVmMr2881f2TNVIUo6irIsgqp9KZYXeAVggEvXN9nyIQBUupl1RLUPgs9EM';
              if (!subscription) {
                registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                }).then(newSubscription => {
                  subscribeUser(newSubscription);
                }).catch(error => {
                  console.error('Failed to subscribe the user:', error);
                });
              } else {
                subscribeUser(subscription);
              }
            });
          });
        }
      });
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!loading && isLoggedIn && user?.gizmo_id) {
      const fetchUserData = async () => {
        try {
          const { points } = await fetchUserPoints(user.gizmo_id);
          setUserPoints(points);
          setError(null);
        } catch (err) {
          console.error('Error fetching user data:', err);
          setUserPoints(null);
          setError('Failed to load points');
        }
      };
      fetchUserData();
    } else {
      // Reset points if no gizmo_id is available
      setUserPoints(null);
    }
  }, [loading, isLoggedIn, user]);

  const subscribeUser = (subscription) => {
    fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription }),
    }).then(response => {
      if (response.ok) {
        console.log('User is subscribed');
      } else {
        console.error('Failed to subscribe the user');
      }
    });
  };

  const navigateToAvailableComputers = () => {
    router.push('/avcomputers'); // Navigate to available computers page
  };

  const navigateToShop = () => {
    router.push('/shop'); // Navigate to the shop page
  };

  const navigateToChat = () => {
    router.push('/chat'); // Navigate to the chat page
  };

  const toggleStatus = async (newStatus) => {
    const response = await fetch('/api/toggleStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (response.ok) {
      setStatus(newStatus);
      alert(`Status set to ${newStatus}`);
    } else {
      alert('Failed to set status');
    }
  };

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

  const navigateToTopUsers = () => {
    router.push('/topusers');
  };

  // Add refresh functionality for points
  const refreshUserData = async () => {
    if (user?.gizmo_id) {
      try {
        const { points } = await fetchUserPoints(user.gizmo_id);
        setUserPoints(points);
        setError(null);
      } catch (err) {
        console.error('Error refreshing user data:', err);
        setError('Failed to refresh data');
      }
    }
  };

  // Add polling for active sessions
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLoggedIn && user) {
        fetchDashboardData();
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [isLoggedIn, user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isLoggedIn || !user) {
    router.push('/');
    return null;
  }

  return (
    <>
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Header />

      <main className={styles.dashboardMain}>
        <section className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle} aria-label={`Welcome back, ${user?.username}`}>
            Welcome back, {user?.username}! 👋
          </h1>
          <p className={styles.welcomeSubtitle}>Here's what's happening at Merrouch Gaming</p>
        </section>

        <div className={styles.statsGrid}>
          {/* Profile Card */}
          <div className={`${styles.statCard} ${styles.largeCard}`} role="region" aria-labelledby="profile-section">
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineUser size={24} />
              </div>
              <h3 id="profile-section" className={styles.statTitle}>Profile</h3>
            </div>
            <div className={styles.profileInfo}>
              <p>
                <strong>Username:</strong>
                <span>{user?.username}</span>
              </p>
              <p>
                <strong>Email:</strong>
                <span>{user?.email}</span>
              </p>
              <p>
                <strong>Supabase ID:</strong>
                <span>{user?.id}</span>
              </p>
              <p>
                <strong>Gizmo ID:</strong>
                <span>{user?.gizmo_id || 'Not linked'}</span>
              </p>
              <p>
                <strong>Points:</strong>
                <span className={userPoints !== null ? getPointsColor(userPoints) : ''}>
                  {userPoints !== null ? userPoints : 'Loading...'}
                </span>
              </p>
              {user?.isAdmin && (
                <p>
                  <strong>Role:</strong>
                  <span>Admin</span>
                </p>
              )}
            </div>
          </div>

          {/* Top Players Card */}
          <div 
            className={`${styles.statCard} ${styles.mediumCard}`} 
            role="button"
            tabIndex={0}
            data-clickable="true"
            onClick={navigateToTopUsers}
            onKeyDown={(e) => e.key === 'Enter' && navigateToTopUsers()}
            aria-label="View all top players"
          >
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineTrophy size={24} />
              </div>
              <h3 id="top-players-section" className={styles.statTitle}>Top Players</h3>
            </div>
            {loading ? (
              <p>Loading top players...</p>
            ) : error ? (
              <p>{error}</p>
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

          {/* Fix Active Sessions Card Structure */}
          <div className={`${styles.statCard} ${styles.smallCard}`} role="region" aria-labelledby="active-sessions-section">
            <div className={styles.statHeader}>
              <div className={styles.statIcon}>
                <AiOutlineDesktop size={24} />
              </div>
              <h3 id="active-sessions-section" className={styles.statTitle}>Active Sessions</h3>
            </div>
            <div className={styles.statValue}>
              {Array.isArray(activeSessions) ? (
                <p>{activeSessions.length} Active {activeSessions.length === 1 ? 'Session' : 'Sessions'}</p>
              ) : (
                <p>0 Active Sessions</p>
              )}
            </div>
          </div>

          {/* Add Refresh Button */}
          <button 
            className={styles.refreshButton}
            onClick={refreshUserData}
            aria-label="Refresh data"
          >
            <AiOutlineReload className={styles.refreshIcon} />
          </button>

        </div>

        <NotificationButton />

        <div className={styles.bubbleButtons}>
          <button 
            className={styles.bubbleButton}
            onClick={navigateToAvailableComputers}
            aria-label="Navigate to Available Computers"
          >
            <AiOutlineDesktop className={styles.bubbleIcon} />
          </button>

          <button 
            className={styles.bubbleButton}
            onClick={navigateToShop}
            aria-label="Navigate to Shop"
          >
            <AiOutlineShop className={styles.bubbleIcon} />
          </button>

          <button 
            className={styles.bubbleButton}
            onClick={navigateToChat}
            aria-label="Navigate to Chat"
          >
            <AiOutlineWechat className={styles.bubbleIcon} />
          </button>
        </div>

        {isAdmin && (
          <div className={styles.adminControls} role="region" aria-labelledby="admin-controls">
            <h3 id="admin-controls" className={styles.adminTitle}>Admin Controls</h3>
            <div className={styles.adminButtons}>
              <button 
                className={`${styles.adminButton} ${styles.openButton}`}
                onClick={() => toggleStatus('on')}
                aria-pressed={status === 'on'}
              >
                Open Gaming Center
              </button>
              <button 
                className={`${styles.adminButton} ${styles.closeButton}`}
                onClick={() => toggleStatus('off')}
                aria-pressed={status === 'off'}
              >
                Close Gaming Center
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error('Base64 string is required');
  }
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default Dashboard;
