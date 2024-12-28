import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Head from 'next/head';
import { fetchTopUsers } from '../utils/api';
import styles from './TopUsers.module.css';

const TopUsers = () => {
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [currentMonth, setCurrentMonth] = useState('');

  const getTopUsers = async () => {
    try {
      const data = await fetchTopUsers(10);
      if (data.length === 0) {
        setError('No users found.');
      } else {
        setTopUsers(data);
      }
    } catch (error) {
      setError(`Error: ${error.message}. Please try again later.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTopUsers();
  }, []);

  useEffect(() => {
    const updateTimeLeft = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const nextMonth = new Date(year, month + 1, 1, 0, 0, 0); // Midnight on the first day of the next month
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
        getTopUsers(); // Refresh the top users list when the timer reaches zero
      }
    };

    updateTimeLeft();
    const intervalId = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(intervalId);
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
    <>
      <Header />
      <Head>
        <title>Top Users</title>
        <meta name="robots" content="index, follow" />
      </Head>
      <main className={styles.main}>
        <h2 className={styles.heading}>Top Users of the Month</h2>
        <p className={styles.counterText}>
          {`Current Month: ${currentMonth} | Time Left Until Next Month: ${timeLeft}`}
        </p>
        {loading && <p>Loading...</p>}
        {error && <p>{error}</p>}
        {!loading && !error && topUsers.length === 0 && <p>No users found.</p>}
        {!loading && !error && topUsers.length > 0 && (
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
    </>
  );
};

export default TopUsers;
