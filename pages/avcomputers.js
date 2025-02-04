import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchActiveUserSessions, fetchUserById, fetchUserBalance } from '../utils/api';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import LoadingScreen from '../components/LoadingScreen';
import styles from '../styles/avcomputers.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';

// Computer component
const ComputerBox = ({ computer, isVip, lastUpdate }) => {
  const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
    ? computer.timeLeft.split(' : ') 
    : [0, 0];
  const hours = parseInt(timeParts[0]) || 0;
  const minutes = parseInt(timeParts[1]) || 0;
  const totalMinutes = hours * 60 + minutes;

  const boxClass = isVip ? styles.vipPcBox : styles.pcSquare;
  const activeClass = computer.isActive
    ? totalMinutes < 60
      ? isVip ? styles.orange : styles.warning
      : styles.active
    : styles.inactive;

  const lastUpdateTime = lastUpdate[computer.id];
  const isRecentlyUpdated = lastUpdateTime && Date.now() - lastUpdateTime < 1000;

  return (
    <div 
      key={computer.id} 
      className={`
        ${boxClass} 
        ${activeClass}
        ${isRecentlyUpdated ? styles.updated : ''}
      `}
    >
      <div className={styles.pcNumber}>
        {isVip ? 'VIP PC' : 'PC'}{computer.number}
      </div>
      <div className={styles.statusText}>
        {computer.isActive 
          ? `Active - Time Left: ${computer.timeLeft}` 
          : 'No User'}
      </div>
    </div>
  );
};

// VIP Computers section
const VIPComputers = ({ computers, lastUpdate }) => {
  const vipContainerRef = useRef(null);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (!initialScrollDone.current && vipContainerRef.current && computers.length > 0) {
      const container = vipContainerRef.current;
      const totalWidth = container.scrollWidth;
      const visibleWidth = container.offsetWidth;
      const scrollToMiddle = (totalWidth - visibleWidth) / 2;

      setTimeout(() => {
        container.scrollLeft = scrollToMiddle;
        initialScrollDone.current = true;
      }, 100);
    }
  }, [computers]);

  return (
    <div className={styles.vipWrapper}>
      <div className={styles.vipSection}>
        <div ref={vipContainerRef} className={styles.vipComputers}>
          {computers.map(computer => (
            <ComputerBox 
              key={computer.id} 
              computer={computer} 
              isVip={true}
              lastUpdate={lastUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Main component
const AvailableComputers = () => {
  const { isLoggedIn, loading, user } = useAuth();
  const router = useRouter();
  const [computers, setComputers] = useState({ normal: [], vip: [] });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState({});
  const prevComputers = useRef({ normal: [], vip: [] });

  // Define computersList inside the component
  const computersList = {
    normal: [
      { number: 1, id: 26 }, { number: 2, id: 12 },
      { number: 3, id: 8 }, { number: 4, id: 5 },
      { number: 5, id: 17 }, { number: 6, id: 11 },
      { number: 7, id: 16 }, { number: 8, id: 14 }
    ],
    vip: [
      { number: 9, id: 21 }, { number: 10, id: 22 },
      { number: 11, id: 25 }, { number: 12, id: 20 },
      { number: 13, id: 24 }, { number: 14, id: 23 }
    ]
  };

  // Auth check
  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, loading, router]);

  const updateSingleComputer = useCallback((computer, newData) => {
    setComputers(prev => {
      const section = computer.number <= 8 ? 'normal' : 'vip';
      const newComputers = {
        ...prev,
        [section]: prev[section].map(pc => 
          pc.id === computer.id ? { ...pc, ...newData } : pc
        )
      };
      return newComputers;
    });
  }, []);

  // Data fetching
  useEffect(() => {
    let mounted = true;
    let intervalId;

    const fetchComputerStatus = async (computer) => {
      try {
        const activeSessions = await fetchActiveUserSessions();
        const session = activeSessions.find(s => s.hostId === computer.id);

        // Check if status has changed
        const currentStatus = {
          isActive: !!session,
          timeLeft: 'No Time'
        };

        if (session) {
          const userData = await fetchUserById(session.userId);
          if (userData) {
            const balance = await fetchUserBalance(userData.id);
            currentStatus.timeLeft = typeof balance === 'string' ? balance : balance.balance || 'No Time';
          }
        }

        // Compare with previous state
        const prevState = prevComputers.current[computer.number <= 8 ? 'normal' : 'vip']
          .find(pc => pc.id === computer.id);

        if (!prevState || 
            prevState.isActive !== currentStatus.isActive || 
            prevState.timeLeft !== currentStatus.timeLeft) {
          if (mounted) {
            updateSingleComputer(computer, currentStatus);
            setLastUpdate(prev => ({ ...prev, [computer.id]: Date.now() }));
          }
        }

      } catch (error) {
        console.error(`Error updating computer ${computer.number}:`, error);
      }
    };

    const fetchAllComputers = async () => {
      if (!isLoggedIn || !user) return;

      try {
        // Fetch initial state if computers are empty
        if (!computers.normal.length && !computers.vip.length) {
          setIsLoading(true);
          const initialComputers = {
            normal: computersList.normal.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' })),
            vip: computersList.vip.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' }))
          };
          if (mounted) {
            setComputers(initialComputers);
            prevComputers.current = initialComputers;
          }
        }

        // Update computers one by one
        for (const computer of [...computersList.normal, ...computersList.vip]) {
          await fetchComputerStatus(computer);
        }

        if (mounted) {
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching computer data:', err);
        if (mounted) {
          setError('Unable to fetch computer data. Please try again.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (isLoggedIn && user) {
      fetchAllComputers();
      intervalId = setInterval(fetchAllComputers, 5000);
    }

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLoggedIn, user, updateSingleComputer, computers.normal.length, computers.vip.length]);

  if (loading || isLoading) {
    return <LoadingScreen />;
  }

  if (!isLoggedIn) {
    return null;
  }

  if (error) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.error}>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Available Computers</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.mainContainer}>
        <h2 className={styles.sectionHeading}>Normal Computers</h2>
        <div className={styles.computerGrid}>
          {computers.normal.map(computer => (
            <ComputerBox 
              key={computer.id} 
              computer={computer} 
              isVip={false}
              lastUpdate={lastUpdate}
            />
          ))}
        </div>

        <h2 className={styles.sectionHeading}>VIP PCs</h2>
        <VIPComputers 
          computers={computers.vip} 
          lastUpdate={lastUpdate}
        />
      </main>
    </ProtectedPageWrapper>
  );
};

export default AvailableComputers;