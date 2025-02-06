import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { fetchTopUsers } from '../utils/api';
import styles from '../styles/TopUsers.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { NextSeo } from 'next-seo';

const TopUsers = () => {
  const [topUsers, setTopUsers] = useState([]);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [currentMonth, setCurrentMonth] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  const getTopUsers = async (isRetry = false) => {
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
      } else {
        setTopUsers(data);
        setError(null);
        setRetryCount(0);
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
      }
    }
  };

  // Combine data fetching and timer setup
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
  }, []);

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
      <NextSeo
        title="Top Gamers & Rewards | Merrouch Gaming Center"
        description="Discover our top gamers in Tangier and their rewards. Monthly gaming competitions with free gaming hours as prizes. Meilleurs joueurs et récompenses à Tanger."
        openGraph={{
          title: 'Top Gamers & Rewards | Merrouch Gaming Center',
          description: 'Monthly gaming competitions and rewards at Merrouch Gaming',
          images: [
            {
              url: 'https://merrouchgaming.com/gaming-center-banner.jpg',
              width: 1200,
              height: 630,
              alt: 'Top Gamers at Merrouch Gaming',
            },
          ],
        }}
      />
      <div className={styles.container}>
        <Head>
          <title>Top Users</title>
          <meta name="robots" content="index, follow" />
        </Head>
        <main className={styles.main}>
          <h2 className={styles.heading}>Top Users of the Month</h2>
          <p className={styles.counterText}>
            {`Current Month: ${currentMonth} | Time Left Until Next Month: ${timeLeft}`}
          </p>
          {error && (
            <p className={`${styles.error} ${error === 'Loading users...' ? styles.loading : ''}`}>
              {error}
            </p>
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
        </main>
      </div>
    </ProtectedPageWrapper>
  );
};

export default TopUsers;
