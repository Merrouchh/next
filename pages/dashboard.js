import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import DashboardUserSearch from '../components/DashboardUserSearch';
import {
  LoadingSpinner,
  ErrorDisplay,
  ProfileInfoCard,
  TimeRemainingCard,
  TopUsersCard,
  ActiveSessionsCard,
  RefreshCard,
  UpcomingMatchesCard
} from '../components/dashboard';
import { useDashboardData } from '../hooks/useDashboardData';
import { 
  createNavigationHandler 
} from '../utils/dashboardHelpers';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { toast } from 'react-hot-toast';
import styles from '../styles/Dashboard.module.css';
import { useCallback, useRef } from 'react';

export async function getServerSideProps({ res }) {
  // Disable all caching - always fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return {
    props: {}
  };
}

const Dashboard = React.memo(() => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error, isRefreshing, refreshData } = useDashboardData();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const lastRefreshTime = useRef(0);
  const refreshAttempts = useRef(0);

  // Create navigation handler
  const handleNavigation = createNavigationHandler(router);


  // Debounced refresh with rate limiting
  const handleRefreshClick = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;
    
    // First time clicking (lastRefreshTime is 0), allow it
    if (lastRefreshTime.current === 0) {
      lastRefreshTime.current = now;
      refreshData(true);
      return;
    }
    
    // Debouncing: Prevent rapid clicks (minimum 2 seconds between refreshes)
    if (timeSinceLastRefresh < 2000) {
      console.log('🚫 Refresh debounced - too fast');
      toast.error('Slow down! Wait a moment before refreshing again 🔄', {
        duration: 2000,
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #ff9800',
        }
      });
      return;
    }
    
    // Rate limiting: Prevent more than 3 refreshes per minute
    if (timeSinceLastRefresh < 60000) { // 1 minute
      refreshAttempts.current++;
      if (refreshAttempts.current > 3) {
        console.log('🚫 Refresh rate limit exceeded');
        toast.error('Please wait before refreshing again! 😅', {
          duration: 3000,
          position: 'top-right',
          style: {
            background: '#333',
            color: '#fff',
            border: '1px solid #ff4444',
          }
        });
        return;
      }
    } else {
      refreshAttempts.current = 0;
    }
    
    // If we get here, the refresh is allowed
    lastRefreshTime.current = now;
    refreshData(true);
  }, [refreshData]);

  // Log successful data load
  console.log('✅ Dashboard rendering with data:', { 
    dataExists: !!data, 
    authLoading, 
    user: user?.username,
    activeSessions: data?.activeSessions?.length || 0,
    topUsers: data?.topUsers?.length || 0
  });

  // Show loading state when no data or during auth
  if (authLoading || (!data && !error)) {
    console.log('Dashboard loading state:', { authLoading, data: data ? 'DATA_EXISTS' : 'DATA_NULL', error, user: user?.username, loading });
    return (
      <ProtectedPageWrapper>
        <LoadingSpinner />
      </ProtectedPageWrapper>
    );
  }

  // Show error state if there's an error and no data
  if (error && !data) {
    console.log('Dashboard error state:', { error, user: user?.username });
    return (
      <ProtectedPageWrapper>
        <ErrorDisplay error={error} />
      </ProtectedPageWrapper>
    );
  }

  // Show setup required state
  if (data?.needsProfileSetup) {
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

  return (
    <>
      <Head>
        <title>Gaming Dashboard | Merrouch Gaming Center</title>
      </Head>
      <ProtectedPageWrapper>
      <main className={styles.dashboardMain} suppressHydrationWarning>

        <section className={styles.welcomeSection}>
          <div className={styles.welcomeContent}>
                          <h1 className={styles.welcomeText}>
              Hey <span className={styles.username}>
                {user?.username ? (
                  user.username.charAt(0).toUpperCase() + user.username.slice(1)
                ) : 'User'}
              </span>!
              {user?.isAdmin && <span className={styles.adminIndicator}>Admin</span>}
              {user?.isStaff && !user?.isAdmin && <span className={styles.adminIndicator}>Staff</span>}
            </h1>
            <DashboardUserSearch />
          </div>
        </section>

        <div className={styles.statsGrid}>
            {/* Profile Info Card */}
            <ProfileInfoCard 
              user={user}
              userPoints={data.userPoints}
              balanceInfo={data.balanceInfo}
            />

            {/* Time Remaining Card */}
            <TimeRemainingCard timeInfo={data.timeInfo} />

            {/* Upcoming Matches - Only show if there are matches and not loading */}
            {!loading && !isRefreshing && data.upcomingMatches && data.upcomingMatches.length > 0 && (
              <UpcomingMatchesCard upcomingMatches={data.upcomingMatches} />
            )}

            {/* Top Users Card */}
          <TopUsersCard 
              topUsers={data.topUsers} 
            handleNavigation={handleNavigation}
          />

            {/* Active Sessions Card */}
          <ActiveSessionsCard 
              activeSessions={data.activeSessions || []} 
            handleNavigation={handleNavigation}
          />

            {/* Refresh Card - Only show on desktop */}
            {!isMobile && (
              <RefreshCard 
                  onRefresh={handleRefreshClick}
                  isLoading={loading || isRefreshing}
              />
            )}
        </div>
      </main>
    </ProtectedPageWrapper>
    </>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;