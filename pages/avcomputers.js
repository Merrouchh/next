import React, { useEffect, useState, useRef } from 'react';
import { fetchActiveUserSessions, fetchUserById, fetchUserBalance } from '../utils/api';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import Header from '../components/Header';
import LoadingScreen from '../components/LoadingScreen';
import styles from '../styles/avcomputers.module.css';
import { createClient } from '../utils/supabase/client';

// Computer component
const ComputerBox = ({ computer, isVip }) => {
  const getStatusClass = () => {
    if (!computer.isActive) {
      return styles.inactive;
    }

    // Parse time left
    const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
      ? computer.timeLeft.split(' : ')
      : [0, 0];
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    const totalMinutes = hours * 60 + minutes;

    // If active but less than 60 minutes remaining
    if (totalMinutes < 60) {
      return isVip ? styles.orange : styles.warning;
    }

    return styles.active;
  };

  return (
    <div className={`${isVip ? styles.vipPcBox : styles.pcSquare} ${getStatusClass()}`}>
      <div className={styles.pcNumber}>
        {isVip ? 'VIP PC ' : 'PC '}{computer.number}
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
const VIPComputers = ({ computers }) => {
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
            <ComputerBox key={computer.id} computer={computer} isVip={true} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Main component
const AvailableComputers = () => {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [computers, setComputers] = useState({ normal: [], vip: [] });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Separate initial load from refresh updates
  const updateComputerStates = async (activeSessions) => {
    const updatePromises = activeSessions.map(async (session) => {
      try {
        const user = await fetchUserById(session.userId);
        if (!user) {
          console.warn(`No user found for session ${session.hostId}`);
          return {
            hostId: session.hostId,
            isActive: true,
            timeLeft: 'Unknown'
          };
        }
        
        try {
          const balance = await fetchUserBalance(user.id);
          return {
            hostId: session.hostId,
            isActive: true,
            timeLeft: balance
          };
        } catch (balanceError) {
          console.warn(`Failed to fetch balance for user ${user.id}:`, balanceError);
          return {
            hostId: session.hostId,
            isActive: true,
            timeLeft: 'Unknown'
          };
        }
      } catch (err) {
        console.error('Error updating computer state:', err);
        return {
          hostId: session.hostId,
          isActive: true,
          timeLeft: 'Error'
        };
      }
    });

    try {
      const updates = await Promise.all(updatePromises);

      setComputers(prev => {
        const newComputers = {
          normal: prev.normal.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' })),
          vip: prev.vip.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' }))
        };

        // Apply active updates
        updates.forEach(update => {
          if (!update) return;
          
          // Update normal computers
          const normalPc = newComputers.normal.find(pc => pc.id === update.hostId);
          if (normalPc) {
            Object.assign(normalPc, {
              isActive: true,
              timeLeft: update.timeLeft
            });
          }
          
          // Update VIP computers
          const vipPc = newComputers.vip.find(pc => pc.id === update.hostId);
          if (vipPc) {
            Object.assign(vipPc, {
              isActive: true,
              timeLeft: update.timeLeft
            });
          }
        });

        return newComputers;
      });
    } catch (err) {
      console.error('Error updating computer states:', err);
    }
  };

  // Initial load
  useEffect(() => {
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

    const initializePage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/');
          return;
        }

        // Set initial state
        setComputers({
          normal: computersList.normal.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' })),
          vip: computersList.vip.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' }))
        });
        setIsLoading(false);

        // Initial data fetch
        const activeSessions = await fetchActiveUserSessions();
        await updateComputerStates(activeSessions);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch computer data');
      }
    };

    initializePage();
  }, [router]);

  // Separate effect for periodic updates
  useEffect(() => {
    let mounted = true;
    
    const refreshData = async () => {
      if (!mounted) return;
      
      try {
        const activeSessions = await fetchActiveUserSessions();
        if (mounted) {
          await updateComputerStates(activeSessions);
        }
      } catch (err) {
        console.error('Refresh error:', err);
      }
    };

    // Initial load
    refreshData();

    // Set up refresh interval
    const intervalId = setInterval(refreshData, 10000);

    // Cleanup
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  if (!isLoggedIn) return null;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <>
      <Head>
        <title>Available Computers</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.mainContainer}>
        <h2 className={styles.sectionHeading}>Normal Computers</h2>
        <div className={styles.computerGrid}>
          {computers.normal.map(computer => (
            <ComputerBox key={computer.id} computer={computer} isVip={false} />
          ))}
        </div>

        <h2 className={styles.sectionHeading}>VIP PCs</h2>
        <VIPComputers computers={computers.vip} />
      </main>
    </>
  );
};

export default AvailableComputers;