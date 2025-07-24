import React, { useMemo } from 'react';
import Head from 'next/head';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { UserCard, Timer, LoadingSpinner, ErrorMessage } from '../components/topusers';
import { useTopUsers } from '../hooks/useTopUsers';
import { processUserData, withPerformanceMonitoring } from '../utils/topUsersHelpers';
import { fetchTopUsers } from '../utils/api';
import styles from '../styles/TopUsers.module.css';

// Use server-side rendering to ensure fresh data every time
export async function getServerSideProps({ res }) {
  // Disable all caching - always fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return {
    props: {
      initialUsers: [],
      timestamp: Date.now()
    }
  };
}

// Main component with performance optimizations
const TopUsers = React.memo(({ initialUsers }) => {
  // Custom hooks for data management
  const { users, loading, error, refresh } = useTopUsers(10);
  
  // Use initial data if available, otherwise use hook data
  const displayUsers = users.length > 0 ? users : initialUsers;
  
  // Debug logging (removed to prevent console spam)
  // console.log('🔍 TopUsers render:', { 
  //   usersLength: users.length, 
  //   loading, 
  //   error, 
  //   initialUsersLength: initialUsers?.length || 0,
  //   displayUsersLength: displayUsers?.length || 0
  // });
  
  // Memoize processed user data to avoid recalculation
  const processedUsers = useMemo(() => {
    return withPerformanceMonitoring(processUserData, 'User Data Processing')(displayUsers);
  }, [displayUsers]);

  // Memoize the user list to prevent unnecessary re-renders
  const UserList = useMemo(() => {
    // Show loading only if we have no data and hook is loading
    if (loading && processedUsers.length === 0) {
      return <LoadingSpinner />;
    }

    if (error && processedUsers.length === 0) {
      return <ErrorMessage message={error} onRetry={refresh} />;
    }

    if (processedUsers.length === 0) {
      return <ErrorMessage message="No users found" onRetry={refresh} />;
    }

    return (
      <div className={styles.userList}>
        {processedUsers.map((user, index) => (
          <UserCard
            key={`${user.name}-${index}`}
            user={user}
            index={index}
            rank={user.rank}
            rewardText={user.rewardText}
          />
        ))}
      </div>
    );
  }, [loading, error, processedUsers, refresh]);

  return (
    <>
      <Head>
        <title>Top Gaming Users | Leaderboards | Merrouch Gaming Center</title>
        <meta 
          name="description" 
          content="View the top gaming users and leaderboards at Merrouch Gaming Center. Monthly competitions with gaming time rewards."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="/topusers" />
      </Head>
      
      <ProtectedPageWrapper>
        <div className={styles.container}>
          <main className={styles.main}>
            <h1 className={styles.heading}>Community Leaderboard</h1>
            <Timer />
            {UserList}
          </main>
        </div>
      </ProtectedPageWrapper>
    </>
  );
});

TopUsers.displayName = 'TopUsers';

export default TopUsers;
