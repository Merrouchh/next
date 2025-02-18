import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { fetchActiveUserSessions, fetchUserBalance, fetchComputers } from '../utils/api';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import LoadingScreen from '../components/LoadingScreen';
import styles from '../styles/avcomputers.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { createClient as createServerClient } from '../utils/supabase/server-props';
import DynamicMeta from '../components/DynamicMeta';

// We can remove cache headers since they're handled globally in next.config.js
export const getServerSideProps = async ({ res }) => {
  // Set cache control headers
  res.setHeader(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate, max-age=0'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const computers = await fetchComputers();
    return {
      props: {
        computers,
        timestamp: Date.now(), // Keep timestamp to force revalidation
        metaData: {
          title: "Computer Status | Merrouch Gaming Center",
          description: "Real-time status of gaming computers. Monitor availability of Normal and VIP PCs.",
          image: "https://merrouchgaming.com/top.jpg",
          url: "https://merrouchgaming.com/avcomputers",
          type: "website",
          noindex: true, // Tell search engines not to index this page
          openGraph: {
            title: "Computer Status | Merrouch Gaming Center",
            description: "Real-time computer availability dashboard",
            images: [
              {
                url: "https://merrouchgaming.com/top.jpg",
                width: 1200,
                height: 630,
                alt: "Merrouch Gaming Computer Status"
              }
            ],
            type: "website"
          }
        }
      },
    };
  } catch (error) {
    console.error('Error fetching computers:', error);
    return {
      props: {
        computers: {
          normal: [],
          vip: []
        },
        timestamp: Date.now(),
        metaData: {
          title: "Computer Status | Merrouch Gaming Center",
          description: "Real-time status of gaming computers",
          noindex: true,
          type: "website"
        }
      },
    };
  }
};

// Computer component
const ComputerBox = ({ computer, isVip, lastUpdate, highlightActive }) => {
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
        ${highlightActive && computer.isActive ? styles.highlight : ''}
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
const VIPComputers = ({ computers, lastUpdate, highlightActive }) => {
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
              highlightActive={highlightActive}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Main component
const AvailableComputers = ({ metaData }) => {
  const { user } = useAuth();  // Simplified auth usage
  const router = useRouter();
  const [computers, setComputers] = useState({ normal: [], vip: [] });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState({});
  const prevComputers = useRef({ normal: [], vip: [] });
  const [highlightActive, setHighlightActive] = useState(false);

  // Move computersList to useMemo to prevent unnecessary recreations
  const computersList = useMemo(() => ({
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
  }), []);

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

  // Optimize data fetching
  useEffect(() => {
    let mounted = true;
    let intervalId;

    const fetchComputerStatus = async (computer) => {
      try {
        const activeSessions = await fetchActiveUserSessions();
        const session = activeSessions.find(s => s.hostId === computer.id);
        
        if (!mounted) return;

        const currentStatus = {
          isActive: false,
          timeLeft: 'No Time',
          userId: null
        };

        if (session) {
          currentStatus.isActive = true;
          currentStatus.userId = session.userId;
          const balance = await fetchUserBalance(session.userId);
          currentStatus.timeLeft = typeof balance === 'string' ? balance : balance.balance || 'No Time';
        }

        updateSingleComputer(computer, currentStatus);
        setLastUpdate(prev => ({ ...prev, [computer.id]: Date.now() }));
        
        const section = computer.number <= 8 ? 'normal' : 'vip';
        prevComputers.current[section] = prevComputers.current[section].map(pc =>
          pc.id === computer.id ? { ...pc, ...currentStatus } : pc
        );

      } catch (error) {
        console.error(`Error updating computer ${computer.number}:`, error);
      }
    };

    const fetchAllComputers = async () => {
      if (!user) return;  // Simplified check

      try {
        await Promise.all([
          ...computersList.normal,
          ...computersList.vip
        ].map(computer => fetchComputerStatus(computer)));

        if (mounted) setError(null);
      } catch (err) {
        console.error('Error fetching computer data:', err);
        if (mounted) setError('Unable to fetch computer data. Please try again.');
      }
    };

    if (user) {  // Simplified check
      fetchAllComputers();
      intervalId = setInterval(fetchAllComputers, 5000);
    }

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [user, updateSingleComputer, computersList]);

  // Initialize computers state
  useEffect(() => {
    if (!computers.normal.length && !computers.vip.length) {
      const initialComputers = {
        normal: computersList.normal.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' })),
        vip: computersList.vip.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' }))
      };
      setComputers(initialComputers);
      prevComputers.current = initialComputers;
      setIsLoading(false);
    }
  }, [computersList, computers.normal.length, computers.vip.length]);

  // Add effect to handle highlighting
  useEffect(() => {
    if (router.query.from === 'dashboard') {
      setHighlightActive(true);
      setTimeout(() => setHighlightActive(false), 2000); // Remove highlight after 2 seconds
    }
  }, [router.query]);

  if (isLoading) {
    return <LoadingScreen />;
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
      <DynamicMeta {...metaData} />
      <main className={styles.mainContainer}>
        <h2 className={styles.sectionHeading}>Normal Computers</h2>
        <div className={styles.computerGrid}>
          {computers.normal.map(computer => (
            <ComputerBox 
              key={computer.id} 
              computer={computer} 
              isVip={false}
              lastUpdate={lastUpdate}
              highlightActive={highlightActive}
            />
          ))}
        </div>

        <h2 className={styles.sectionHeading}>VIP PCs</h2>
        <VIPComputers 
          computers={computers.vip} 
          lastUpdate={lastUpdate}
          highlightActive={highlightActive}
        />
      </main>
    </ProtectedPageWrapper>
  );
};

export default AvailableComputers;