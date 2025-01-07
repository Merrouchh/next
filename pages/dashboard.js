import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/dashboard.module.css';
import { AiOutlineDesktop, AiOutlineShop, AiOutlineUser, AiOutlineTrophy, AiOutlineWechat, AiOutlineReload } from 'react-icons/ai';
import NotificationButton from '../components/NotificationButton';
import { fetchActiveUserSessions, fetchTopUsers, fetchUserPoints, fetchGizmoId } from '../utils/api';
import { createClient } from '../utils/supabase/client';

// Initialize Supabase client
const supabase = createClient();

export default function Dashboard() {
  const { user, loading, isLoggedIn } = useAuth();
  const router = useRouter();
  const [pageState, setPageState] = useState({
    loading: true,
    error: null,
    data: {
      activeSessions: [],
      topUsers: [],
      userPoints: null,
      status: ''
    }
  });
  const [scrollProgress, setScrollProgress] = useState(0);

  // Add session check and API error handling
  const handleApiError = async (error) => {
    if (error.message === 'Auth session missing!' || error.status === 401) {
      const { data: { session }, error: refreshError } = await supabase.auth.getSession();
      
      if (refreshError || !session) {
        router.push('/');
        return true;
      }
    }
    return false;
  };

  // Add to your existing useEffect
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/');
      }
    };
    
    checkSession();
  }, [router]);

  // Add loading state timeout
  useEffect(() => {
    let timeoutId;
    if (loading) {
      timeoutId = setTimeout(() => {
        // If still loading after 5 seconds, redirect to home
        if (!isLoggedIn) {
          window.location.href = '/';
        }
      }, 5000);
    }
    return () => clearTimeout(timeoutId);
  }, [loading, isLoggedIn]);

  // Add session verification
  useEffect(() => {
    const verifySession = async () => {
      if (!loading) {
        if (!isLoggedIn || !user) {
          await router.replace('/');
        }
      }
    };

    verifySession();
  }, [loading, isLoggedIn, user, router]);

  // Single useEffect for initialization and auth check
  useEffect(() => {
    let mounted = true;

    const initializePage = async () => {
      try {
        // Wait for auth to be ready
        if (loading) return;

        // Check auth status
        if (!isLoggedIn || !user) {
          console.log('Not authenticated, redirecting to home');
          await router.replace('/');
          return;
        }

        // Fetch all required data
        const [sessions, users] = await Promise.all([
          fetchActiveUserSessions(),
          fetchTopUsers(5)
        ]);

        if (!mounted) return;

        // Update state atomically
        setPageState(prev => ({
          ...prev,
          loading: false,
          data: {
            ...prev.data,
            activeSessions: sessions,
            topUsers: users
          }
        }));

        // Fetch user points separately as it depends on gizmoId
        console.log(`Fetching Gizmo ID for user: ${user.username}`);
        const { gizmoId } = await fetchGizmoId(user.username);
        console.log(`Fetched Gizmo ID: ${gizmoId}`);
        if (gizmoId) {
          console.log(`Fetching user points for Gizmo ID: ${gizmoId}`);
          const { points } = await fetchUserPoints(gizmoId);
          console.log(`Fetched user points: ${points}`);
          if (mounted) {
            setPageState(prev => ({
              ...prev,
              data: {
                ...prev.data,
                userPoints: points
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        if (mounted) {
          setPageState(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to load dashboard data'
          }));
        }
      }
    };

    initializePage();

    return () => {
      mounted = false;
    };
  }, [loading, isLoggedIn, user, router]);

  // Add scroll progress effect
  useEffect(() => {
    const handleScroll = () => {
      const winScroll = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollProgress(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Updated loading render
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>
          {isLoggedIn ? 'Loading dashboard...' : 'Checking authentication...'}
        </p>
      </div>
    );
  }

  // Add immediate return if not authenticated
  if (!isLoggedIn || !user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  // Destructure page state for easier access
  const { error } = pageState;
  const { activeSessions, topUsers, userPoints, status } = pageState.data;

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

  const navigateToAvailableComputers = async () => {
    try {
      await router.push('/avcomputers');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const navigateToShop = async () => {
    try {
      await router.push('/shop');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const navigateToChat = async () => {
    try {
      await router.push('/chat');
    } catch (error) {
      console.error('Navigation error:', error);
    }
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

  const navigateToTopUsers = async () => {
    try {
      await router.push('/topusers');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // Add refresh functionality for points
  const refreshUserData = async () => {
    if (user) {
      try {
        console.log(`Refreshing Gizmo ID for user: ${user.username}`);
        const { gizmoId } = await fetchGizmoId(user.username);
        console.log(`Refreshed Gizmo ID: ${gizmoId}`);
        if (!gizmoId) {
          throw new Error('Gizmo ID not found');
        }

        console.log(`Refreshing user points for Gizmo ID: ${gizmoId}`);
        const { points } = await fetchUserPoints(gizmoId);
        console.log(`Refreshed user points: ${points}`);
        setPageState(prev => ({
          ...prev,
          data: {
            ...prev.data,
            userPoints: points
          },
          error: null
        }));
      } catch (err) {
        console.error('Error refreshing user data:', err);
        setPageState(prev => ({
          ...prev,
          error: 'Failed to refresh data'
        }));
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isLoggedIn || !user) {
    router.push('/');
    return null;
  }

  // Update button click handlers to prevent default and use async/await
  const handleNavigation = (handler) => async (e) => {
    e.preventDefault();
    await handler();
  };

  return (
    <>
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={styles.scrollProgress}>
        <div 
          className={styles.scrollBar} 
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <main className={styles.dashboardMain}>
        {/* Remove any extra padding/margin at the top */}
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
              {user?.is_admin && (
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
            onClick={handleNavigation(navigateToTopUsers)}
            onKeyDown={(e) => e.key === 'Enter' && navigateToTopUsers()}
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
            onClick={handleNavigation(navigateToAvailableComputers)}
            aria-label="Navigate to Available Computers"
          >
            <AiOutlineDesktop className={styles.bubbleIcon} />
          </button>

          <button 
            className={styles.bubbleButton}
            onClick={handleNavigation(navigateToShop)}
            aria-label="Navigate to Shop"
          >
            <AiOutlineShop className={styles.bubbleIcon} />
          </button>

          <button 
            className={styles.bubbleButton}
            onClick={handleNavigation(navigateToChat)}
            aria-label="Navigate to Chat"
          >
            <AiOutlineWechat className={styles.bubbleIcon} />
          </button>
        </div>

        {user?.is_admin && (
          <div className={styles.adminSection}>
            <h2>Admin Section</h2>
            <p>Here you can manage user information and other admin tasks.</p>
            {/* Add admin-specific functionality here */}
          </div>
        )}
        
      </main>
    </>
  );
};

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
