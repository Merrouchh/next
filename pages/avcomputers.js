import React, { useEffect, useState, useRef } from 'react';
import { fetchActiveUserSessions, fetchUserById, fetchUserBalance } from '../utils/api';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import Header from '../components/Header'; // Add this import
import LoadingScreen from '../components/LoadingScreen';
import styles from '../styles/avcomputers.module.css';
import { createClient } from '../utils/supabase/client';

// Computer component
const ComputerBox = ({ computer, isVip }) => {
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

  return (
    <div key={computer.id} className={`${boxClass} ${activeClass}`}>
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
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const [computers, setComputers] = useState({ normal: [], vip: [] });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
      }
    };
    
    checkAuth();
  }, [router]);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/');
      }
    });

    return () => subscription?.unsubscribe();
  }, [router]);

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

  // Data fetching
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

    const fetchData = async () => {
      try {
        const activeSessions = await fetchActiveUserSessions();
        const updateComputers = async (list) => {
          return Promise.all(list.map(async (computer) => {
            const session = activeSessions.find(s => s.hostId === computer.id);
            if (!session) return { ...computer, isActive: false, timeLeft: 'No Time' };

            const user = await fetchUserById(session.userId);
            const balance = user ? await fetchUserBalance(user.id) : 'No Time';
            return {
              ...computer,
              isActive: true,
              timeLeft: balance
            };
          }));
        };

        const [normalComputers, vipComputers] = await Promise.all([
          updateComputers(computersList.normal),
          updateComputers(computersList.vip)
        ]);

        setComputers({ normal: normalComputers, vip: vipComputers });
        setError(null);
      } catch (err) {
        const isAuthError = await handleApiError(err);
        if (!isAuthError) {
          setError('Failed to fetch computer data');
          console.error(err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading || isLoading) return <LoadingScreen />;
  if (!isLoggedIn) return null;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <>
      <Head>
        <title>Available Computers</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Header /> {/* Add the Header component here */}
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