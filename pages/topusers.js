import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { fetchTopUsers } from '../utils/api';
import styles from '../styles/TopUsers.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { NextSeo } from 'next-seo';
import DynamicMeta from '../components/DynamicMeta';

export async function getServerSideProps({ res }) {
  // Set cache headers for top users page
  res.setHeader(
    'Cache-Control',
    'public, max-age=15, stale-while-revalidate=30'
  );
  res.setHeader(
    'Surrogate-Control',
    'public, max-age=15, stale-while-revalidate=30'
  );

  return {
    props: {
      timestamp: Date.now(),
      metaData: {
        title: "Gaming Community Leaderboard | Merrouch Gaming Center",
        description: "Join our monthly gaming competitions and earn rewards! Discover Tangier's most active gamers and become part of our thriving gaming community. Free gaming time rewards for top performers.",
        image: "https://merrouchgaming.com/top.jpg",
        url: "https://merrouchgaming.com/topusers",
        type: "website",
        openGraph: {
          title: "Gaming Community Leaderboard | Merrouch Gaming Center",
          description: "Join our monthly gaming competitions and earn rewards! Discover Tangier's most active gamers and become part of our thriving community.",
          images: [
            {
              url: "https://merrouchgaming.com/top.jpg",
              width: 1200,
              height: 630,
              alt: "Merrouch Gaming Community Leaderboard"
            }
          ],
          type: "website"
        },
        twitter: {
          card: "summary_large_image",
          site: "@merrouchgaming",
          title: "Gaming Community Leaderboard | Merrouch Gaming Center",
          description: "Monthly gaming competitions with rewards! Join our active gaming community in Tangier and compete for free gaming time.",
          image: "https://merrouchgaming.com/top.jpg"
        }
      }
    }
  };
}

// Loading spinner component
const LoadingSpinner = () => (
  <div className={styles.loadingContainer}>
    <div className={styles.spinner}>
      <div className={styles.spinnerInner}></div>
    </div>
    <p className={styles.loadingText}>Loading users...</p>
  </div>
);

const TopUsers = ({ metaData }) => {
  const [topUsers, setTopUsers] = useState([]);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [currentMonth, setCurrentMonth] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  const getTopUsers = useCallback(async (isRetry = false) => {
    setIsLoading(true);
    try {
      const data = await fetchTopUsers(10);
      if (data.length === 0 && retryCount < MAX_RETRIES) {
        // If no users found and we haven't exceeded max retries
        setRetryCount(prev => prev + 1);
        setTimeout(() => getTopUsers(true), RETRY_DELAY);
        if (!isRetry) {
          setError('Loading users...');
        }
      } else if (data.length === 0) {
        setError('Unable to load users at the moment. Please try again later.');
        setTopUsers([]);
        setIsLoading(false);
      } else {
        setTopUsers(data);
        setError(null);
        setRetryCount(0);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching top users:', error);
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => getTopUsers(true), RETRY_DELAY);
        if (!isRetry) {
          setError('Loading users...');
        }
      } else {
        setError('Service temporarily unavailable. Please try again later.');
        setTopUsers([]);
        setIsLoading(false);
      }
    }
  }, [retryCount]); // Add retryCount as dependency

  useEffect(() => {
    let mounted = true;
    let timerInterval;
    let refreshInterval;
    
    const updateTimeLeft = () => {
      if (!mounted) return;
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const nextMonth = new Date(year, month + 1, 1, 0, 0, 0);
      const timeDiff = nextMonth - now;

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      setCurrentMonth(monthNames[month]);

      if (timeDiff <= 0) {
        getTopUsers();
      }
    };

    const refreshData = async () => {
      if (!mounted) return;
      await getTopUsers();
    };

    // Initial fetch with retry capability
    refreshData();
    updateTimeLeft();

    // Set up intervals
    timerInterval = setInterval(updateTimeLeft, 1000);
    refreshInterval = setInterval(refreshData, 30000); // Refresh every 30 seconds

    return () => {
      mounted = false;
      clearInterval(timerInterval);
      clearInterval(refreshInterval);
    };
  }, [getTopUsers]); // Add getTopUsers as dependency

  const getPodiumIcon = (index) => {
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return index + 1;
    }
  };

  const getRewardText = (index) => {
    switch (index) {
      case 0:
        return 'Win 2 hours';
      case 1:
        return 'Win 1.5 hours';
      case 2:
        return 'Win 1 hour';
      default:
        return 'Win 30 minutes';
    }
  };

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <div className={styles.container}>
        <Head>
          <title>Top Users</title>
          <meta name="robots" content="index, follow" />
        </Head>
        <main className={styles.main}>
          <h2 className={styles.heading}>Community Leaderboard</h2>
          <p className={styles.counterText}>
            {`Current Month: ${currentMonth} | Time Left Until Next Month: ${timeLeft}`}
          </p>
          
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              {error && error !== 'Loading users...' && (
                <p className={styles.error}>{error}</p>
              )}
              {!error && topUsers.length > 0 && (
                <div className={styles.userList}>
                  {topUsers.map((user, index) => (
                    <div key={index} className={`${styles.userItem} ${index < 3 ? styles.podium : ''}`}>
                      <span className={styles.rank}>{getPodiumIcon(index)}</span>
                      <input
                        type="text"
                        className={styles.userInput}
                        value={user.name}
                        readOnly
                        style={{ textAlign: 'center' }}
                      />
                      <span className={styles.rewardText}>{getRewardText(index)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </ProtectedPageWrapper>
  );
};

export default TopUsers;
