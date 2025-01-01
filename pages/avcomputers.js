import React, { useEffect, useState, useRef } from 'react';
import { fetchActiveUserSessions, fetchUserById, fetchUserBalance } from '../utils/api';
import Header from '../components/Header';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext'; // Assuming you have an Auth context
import Head from 'next/head';
import styles from '../styles/avcomputers.module.css';

const HostVipComputers = () => {
  const [computers, setComputers] = useState([]);
  const vipContainerRef = useRef(null);
  const initialScrollDone = useRef(false); // Add this ref to track initial scroll

  useEffect(() => {
    const computersList = [
      { number: 9, id: 21 },
      { number: 10, id: 22 },
      { number: 11, id: 25 },
      { number: 12, id: 20 },
      { number: 13, id: 24 },
      { number: 14, id: 23 },
    ];

    const fetchComputersData = async () => {
      const activeSessions = await fetchActiveUserSessions();
      const updatedComputers = await Promise.all(computersList.map(async (computer) => {
        const session = activeSessions.find(s => s.hostId === computer.id);
        let timeLeft = null;

        if (session) {
          const user = await fetchUserById(session.userId);
          if (user) {
            const balance = await fetchUserBalance(user.id);
            timeLeft = balance;
          }
        }

        return {
          number: computer.number,
          id: computer.id,
          isActive: !!session,
          timeLeft: timeLeft || 'No Time'
        };
      }));

      setComputers(updatedComputers); 
    };

    fetchComputersData();
    const intervalId = setInterval(fetchComputersData, 8000); 

    return () => clearInterval(intervalId); 
  }, []);

  // Modified scroll effect to run only once
  useEffect(() => {
    if (!initialScrollDone.current && vipContainerRef.current && computers.length > 0) {
      const container = vipContainerRef.current;
      
      // Calculate scroll position to show middle items
      const totalWidth = container.scrollWidth;
      const visibleWidth = container.offsetWidth;
      const scrollToMiddle = (totalWidth - visibleWidth) / 2;

      // Set initial scroll position
      setTimeout(() => {
        container.scrollLeft = scrollToMiddle;
        initialScrollDone.current = true; // Mark as done after first scroll
      }, 100);
    }
  }, [computers]);

  return (
    <div className={styles.vipWrapper}>
      <div className={styles.vipSection}>
        <div 
          ref={vipContainerRef}
          className={styles.vipComputers}
        >
          {computers.map(computer => {
            const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
              ? computer.timeLeft.split(' : ') 
              : [0, 0];
            const hours = parseInt(timeParts[0]) || 0;
            const minutes = parseInt(timeParts[1]) || 0;
            const totalMinutes = hours * 60 + minutes;

            return (
              <div key={computer.id} 
                   className={`${styles.vipPcBox} ${
                     computer.isActive 
                       ? totalMinutes < 60 
                         ? styles.orange 
                         : styles.active
                       : styles.inactive
                   }`}>
                <div className={styles.pcNumber}>VIP PC{computer.number}</div>
                <div className={styles.statusText}>
                  {computer.isActive 
                    ? `Active - Time Left: ${computer.timeLeft}` 
                    : 'No User'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AvailableComputers = () => {
  const { isLoggedIn } = useAuth(); 
  const router = useRouter();
  const [computers, setComputers] = useState([]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/'); 
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    const computersList = [
      { number: 1, id: 26 },
      { number: 2, id: 12 },
      { number: 3, id: 8 },
      { number: 4, id: 5 },
      { number: 5, id: 17 },
      { number: 6, id: 11 },
      { number: 7, id: 16 },
      { number: 8, id: 14 }
    ];

    const fetchComputersData = async () => {
      const activeSessions = await fetchActiveUserSessions();
      const updatedComputers = await Promise.all(computersList.map(async (computer) => {
        const session = activeSessions.find(s => s.hostId === computer.id);
        let timeLeft = null;

        if (session) {
          const user = await fetchUserById(session.userId);
          if (user) {
            const balance = await fetchUserBalance(user.id);
            timeLeft = balance;
          }
        }

        return {
          number: computer.number,
          id: computer.id,
          isActive: !!session,
          timeLeft: timeLeft || 'No Time'
        };
      }));

      setComputers(updatedComputers); 
    };

    fetchComputersData();
    const intervalId = setInterval(fetchComputersData, 5000); 

    return () => clearInterval(intervalId); 
  }, []); 

  if (!isLoggedIn) return null;

  return (
    <>
      <Header />
      <Head>
        <title>Available Computers</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.mainContainer}>
        <h2 className={styles.sectionHeading}>Normal Computers</h2>
        <div className={styles.computerGrid}>
          {computers.map(computer => {
            const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
              ? computer.timeLeft.split(' : ') 
              : [0, 0];
            const hours = parseInt(timeParts[0]) || 0;
            const minutes = parseInt(timeParts[1]) || 0;
            const totalMinutes = hours * 60 + minutes;

            return (
              <div key={computer.id} 
                   className={`${styles.pcSquare} ${
                     computer.isActive 
                       ? totalMinutes < 60 
                         ? styles.warning 
                         : styles.active
                       : styles.inactive
                   }`}>
                <div className={styles.pcNumber}>PC{computer.number}</div>
                <div className={styles.statusText}>
                  {computer.isActive 
                    ? `Active - Time Left: ${computer.timeLeft}` 
                    : 'No User'}
                </div>
              </div>
            );
          })}
        </div>

        <h2 className={styles.sectionHeading}>VIP PCs</h2>
        <HostVipComputers />
      </main>
    </>
  );
};

export default AvailableComputers;
