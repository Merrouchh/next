import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaUsers, FaDesktop, FaClock, FaTh, FaList, FaLaptop, FaCheck } from 'react-icons/fa';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AdminDashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { fetchActiveUserSessions } from '../../utils/api';

// Add useInterval custom hook for auto-refresh
const useInterval = (callback, delay) => {
  const savedCallback = React.useRef();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
};

// Add a debug mode flag for controlling console logs
const debugMode = false;

// Update the debugging helper
const debugLog = (message, data) => {
  if (debugMode) {
    console.log(`[DEBUG] ${message}:`, data);
  }
};

export default function SessionsManager() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    activeSessions: [],
    loading: true
  });
  const [sessionViewMode, setSessionViewMode] = useState('grid'); // 'list' or 'grid'
  
  // Add a ref for the AbortController
  const abortControllerRef = React.useRef(null);

  // Add computer data structures
  const allComputers = {
    normal: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      hostId: [26, 12, 8, 5, 17, 11, 16, 14][i] || (i + 1),
      number: i + 1,
      type: 'normal'
    })),
    vip: Array.from({ length: 6 }, (_, i) => ({
      id: i + 9,
      hostId: [21, 22, 25, 20, 24, 23][i] || (i + 9),
      number: i + 1,
      displayNumber: i + 9,
      type: 'vip'
    }))
  };

  // Format the session count
  const formatSessionCount = (activeCount) => {
    const totalCapacity = 14;
    return `${activeCount}/${totalCapacity}`;
  };

  // Fix the active session helper functions
  const formatTimeLeft = (timeLeft) => {
    if (!timeLeft || timeLeft === 'No Time') return 'No Time';
    // If it's already in the right format, return it
    if (typeof timeLeft === 'string' && timeLeft.includes(':')) return timeLeft;
    // Otherwise, try to format it
    return timeLeft;
  };

  const getSessionStatus = (timeLeft) => {
    if (!timeLeft || timeLeft === 'No Time') return 'noTime';
    
    let hours = 0;
    let minutes = 0;
    
    // Handle different time formats
    if (typeof timeLeft === 'string') {
      if (timeLeft.includes(':')) {
        // Format "HH:MM" or "H:MM"
        const parts = timeLeft.split(':');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
      } else if (timeLeft.includes(' : ')) {
        // Format "H : MM"
        const parts = timeLeft.split(' : ');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
      }
    }
    
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes <= 0) {
      return 'expired';
    } else if (totalMinutes < 60) {
      return 'warning';
    } else {
      return 'normal';
    }
  };

  // Get computer type based on host ID
  const getComputerType = (hostId) => {
    if (!hostId) return 'Unknown';
    
    // Mapping hostId to computer type
    const vipHostIds = [21, 22, 25, 20, 24, 23]; // VIP PC IDs
    const normalHostIds = [26, 12, 8, 5, 17, 11, 16, 14]; // Normal PC IDs
    
    if (vipHostIds.includes(Number(hostId))) {
      return 'VIP';
    } else if (normalHostIds.includes(Number(hostId))) {
      return 'Normal';
    } else {
      return 'Unknown';
    }
  };

  // Get computer number based on host ID
  const getComputerNumber = (hostId) => {
    if (!hostId) return 'Unknown';
    
    // Maps host IDs to numbers 1-8 for normal, 9-14 for VIP
    const computerMap = {
      26: 1, 12: 2, 8: 3, 5: 4, 17: 5, 11: 6, 16: 7, 14: 8, // Normal PCs
      21: 9, 22: 10, 25: 11, 20: 12, 24: 13, 23: 14 // VIP PCs
    };
    
    return computerMap[hostId] || hostId;
  };

  // Add a function to count low time computers
  const countLowTimeComputers = (sessions) => {
    if (!sessions || sessions.length === 0) return { normal: 0, vip: 0 };
    
    const lowTime = {
      normal: 0,
      vip: 0
    };
    
    sessions.forEach(session => {
      // Skip if no time left data
      if (!session.timeLeft || session.timeLeft === 'No Time') return;
      
      // Check if time left is less than 1 hour
      const status = getSessionStatus(session.timeLeft);
      if (status === 'warning') {
        const computerType = getComputerType(session.hostId);
        if (computerType === 'Normal') {
          lowTime.normal++;
        } else if (computerType === 'VIP') {
          lowTime.vip++;
        }
      }
    });
    
    return lowTime;
  };

  // Add a toggleView function
  const toggleSessionViewMode = () => {
    setSessionViewMode(prevMode => prevMode === 'list' ? 'grid' : 'list');
  };

  // Prepare computer data with session info
  const prepareComputersWithSessionData = () => {
    const { activeSessions } = stats;
    if (!activeSessions || activeSessions.length === 0) {
      // Return empty arrays if no sessions
      return {
        sortedVipComputers: [],
        normalRow1: [],
        normalRow2: []
      };
    }

    // Clone computers to avoid mutation
    const vipComputers = allComputers.vip.map(c => ({ ...c }));
    const normalComputers = allComputers.normal.map(c => ({ ...c }));

    // Map sessions to computers
    activeSessions.forEach(session => {
      if (!session.hostId) return;
      
      const hostId = Number(session.hostId);
      
      // Find matching computer
      let computer = [...vipComputers, ...normalComputers].find(c => c.hostId === hostId);
      if (!computer) return;
      
      // Add session data to computer
      computer.session = {
        ...session,
        userName: session.userName || `User ${session.userId}`,
        timeLeft: formatTimeLeft(session.timeLeft),
        status: getSessionStatus(session.timeLeft)
      };
    });

    // Sort VIP computers in numerical order (1-6)
    const sortedVipComputers = vipComputers.sort((a, b) => a.number - b.number);
    
    // Create arrays for each row of normal computers
    // First row: Normal 7, 5, 3, 1
    const normalRow1 = [
      normalComputers.find(c => c.number === 7) || { ...allComputers.normal[6] },
      normalComputers.find(c => c.number === 5) || { ...allComputers.normal[4] },
      normalComputers.find(c => c.number === 3) || { ...allComputers.normal[2] },
      normalComputers.find(c => c.number === 1) || { ...allComputers.normal[0] }
    ];
    
    // Second row: Normal 8, 6, 4, 2
    const normalRow2 = [
      normalComputers.find(c => c.number === 8) || { ...allComputers.normal[7] },
      normalComputers.find(c => c.number === 6) || { ...allComputers.normal[5] },
      normalComputers.find(c => c.number === 4) || { ...allComputers.normal[3] },
      normalComputers.find(c => c.number === 2) || { ...allComputers.normal[1] }
    ];
    
    return { sortedVipComputers, normalRow1, normalRow2 };
  };

  // Add helper function to parse time left into minutes for sorting
  const parseTimeLeftToMinutes = (timeLeft) => {
    if (!timeLeft || timeLeft === 'No Time') return 9999; // Put 'No Time' sessions at the end
    
    let hours = 0;
    let minutes = 0;
    
    // Handle different time formats
    if (typeof timeLeft === 'string') {
      if (timeLeft.includes(':')) {
        // Format "HH:MM" or "H:MM"
        const parts = timeLeft.split(':');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
      } else if (timeLeft.includes(' : ')) {
        // Format "H : MM"
        const parts = timeLeft.split(' : ');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
      }
    }
    
    return hours * 60 + minutes;
  };

  // Update the fetchActiveSessionsWithDetails function to use the new API endpoint
  const fetchActiveSessionsWithDetails = async (signal) => {
    try {
      // First, get the basic active sessions
      const activeSessions = await fetchActiveUserSessions(signal);
      
      // If no sessions, return empty array
      if (!activeSessions || activeSessions.length === 0) {
        return [];
      }
      
      debugLog('Basic active sessions', activeSessions);
      
      // Create a copy to work with
      const enhancedSessions = [...activeSessions];
      
      // For each session, fetch username and time left in parallel
      await Promise.all(enhancedSessions.map(async (session, index) => {
        if (!session.userId) return;
        
        // Fetch username using our new dedicated API endpoint with gizmoId parameter
        try {
          const userResponse = await fetch(`/api/users/${session.userId}/username`, {
            headers: { 'Content-Type': 'application/json' },
            signal: signal
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            debugLog(`Username API response for user`, { userId: session.userId, data: userData });
            
            if (userData && userData.success && userData.username) {
              enhancedSessions[index].userName = userData.username;
            } else {
              debugLog(`No username found for user`, session.userId);
              enhancedSessions[index].userName = `User ${session.userId}`;
            }
          }
        } catch (userError) {
          if (userError.name !== 'AbortError') {
            console.error(`Error fetching username for ${session.userId}:`, userError);
            enhancedSessions[index].userName = `User ${session.userId}`;
          }
        }
        
        // Fetch time left
        try {
          const balanceResponse = await fetch(`/api/fetchuserbalance/${session.userId}`, {
            headers: { 'Content-Type': 'application/json' },
            signal: signal
          });
          
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            enhancedSessions[index].timeLeft = balanceData.balance || 'No Time';
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error(`Error fetching balance for session ${index}:`, error);
          }
        }
      }));
      
      // Log the final enhanced sessions
      debugLog('Final enhanced sessions with usernames', enhancedSessions);
      
      return enhancedSessions;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error in fetchActiveSessionsWithDetails:', error);
      }
      return [];
    }
  };

  // Get session stats
  const fetchSessionStats = async () => {
    if (!user) return;
    
    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;
      
      // Get active sessions with time details
      const sessionsWithDetails = await fetchActiveSessionsWithDetails(signal);
      
      // Update stats 
      setStats(prev => ({
        activeSessions: sessionsWithDetails || prev.activeSessions,
        loading: false // Always set loading to false
      }));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching admin stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Set up auto-refresh with useInterval (5 seconds = 5000ms)
  useInterval(() => {
    // Only fetch if component is mounted and the tab is active
    if (document.visibilityState === 'visible') {
      fetchSessionStats();
    }
  }, 5000);

  // Add initial useEffect to set loading to false after first data fetch
  useEffect(() => {
    // Only set loading to true for the initial fetch
    setStats(prev => ({ ...prev, loading: true }));
    
    // Fetch initial data
    fetchSessionStats();
    
    // Set a timeout to ensure loading state is cleared even if fetch fails
    const timer = setTimeout(() => {
      setStats(prev => ({ ...prev, loading: false }));
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [user, supabase]);

  // Update the cleanup effect to use the ref
  useEffect(() => {
    return () => {
      // Abort any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <AdminPageWrapper>
      <Head>
        <title>MerrouchGaming - Session Manager</title>
      </Head>
      
      <div className={styles.adminDashboard}>
        <div className={styles.sessionManagerHeader}>
          <h1 className={styles.dashboardTitle}>SESSION MANAGER</h1>
          <div className={styles.viewToggle}>
            <FaTh className={sessionViewMode === 'grid' ? styles.activeViewIcon : styles.viewIcon} onClick={() => setSessionViewMode('grid')} />
          </div>
        </div>
        
        {/* Session Status Overview */}
        <div className={styles.statsCards}>
          <div className={styles.statCard}>
            <div className={styles.statIconContainer}>
              <FaUsers className={styles.statIconLarge} />
            </div>
            <div className={styles.statContent}>
              <h3 className={styles.statName}>ACTIVE SESSIONS</h3>
              <p className={styles.statValueLarge}>
                {formatSessionCount(stats.activeSessions.length)}
              </p>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIconContainer}>
              <FaDesktop className={styles.statIconLarge} />
            </div>
            <div className={styles.statContent}>
              <h3 className={styles.statName}>NORMAL PCS</h3>
              <p className={styles.statValueLarge}>
                {stats.activeSessions.filter(s => getComputerType(s.hostId) === 'Normal').length}/8
              </p>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIconContainer}>
              <FaLaptop className={styles.statIconLarge} />
            </div>
            <div className={styles.statContent}>
              <h3 className={styles.statName}>VIP PCS</h3>
              <p className={styles.statValueLarge}>
                {stats.activeSessions.filter(s => getComputerType(s.hostId) === 'VIP').length}/6
              </p>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIconContainer}>
              <FaClock className={styles.statIconLarge} />
            </div>
            <div className={styles.statContent}>
              <h3 className={styles.statName}>LOW TIME</h3>
              <p className={styles.statValueLarge}>
                {countLowTimeComputers(stats.activeSessions).normal + 
                 countLowTimeComputers(stats.activeSessions).vip}
              </p>
            </div>
          </div>
        </div>
        
        <h2 className={styles.computerStatusTitle}>COMPUTER STATUS</h2>
        
        {/* VIP Computers Section */}
        <div className={styles.computerSection}>
          <h3 className={styles.computerSectionTitle}>VIP COMPUTERS</h3>
          <div className={styles.computerGrid}>
            {prepareComputersWithSessionData().sortedVipComputers.map(computer => (
              <div 
                key={computer.id} 
                className={`${styles.computerCard} ${computer.session ? styles.activeComputer : styles.inactiveComputer}`}
              >
                {computer.session ? (
                  <div className={styles.sessionInfo}>
                    <div className={styles.computerLabel}>
                      VIP {computer.number}
                    </div>
                    <div className={styles.userName}>{computer.session.userName}</div>
                    <div className={`${styles.timeLeft} ${styles[computer.session.status]}`}>
                      {computer.session.timeLeft}
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyComputer}>
                    <div className={styles.computerLabel}>VIP {computer.number}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Normal Computers Section */}
        <div className={styles.computerSection}>
          <h3 className={styles.computerSectionTitle}>NORMAL COMPUTERS</h3>
          <div className={styles.normalComputerGrid}>
            {/* First Row (7, 5, 3, 1) */}
            <div className={styles.normalComputerRow}>
              {prepareComputersWithSessionData().normalRow1.map(computer => (
                <div 
                  key={computer.id} 
                  className={`${styles.computerCard} ${computer.session ? styles.activeComputer : styles.inactiveComputer}`}
                >
                  {computer.session ? (
                    <div className={styles.sessionInfo}>
                      <div className={styles.computerLabel}>
                        Normal {computer.number}
                      </div>
                      <div className={styles.userName}>{computer.session.userName}</div>
                      <div className={`${styles.timeLeft} ${styles[computer.session.status]}`}>
                        {computer.session.timeLeft}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.emptyComputer}>
                      <div className={styles.computerLabel}>Normal {computer.number}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Second Row (8, 6, 4, 2) */}
            <div className={styles.normalComputerRow}>
              {prepareComputersWithSessionData().normalRow2.map(computer => (
                <div 
                  key={computer.id} 
                  className={`${styles.computerCard} ${computer.session ? styles.activeComputer : styles.inactiveComputer}`}
                >
                  {computer.session ? (
                    <div className={styles.sessionInfo}>
                      <div className={styles.computerLabel}>
                        Normal {computer.number}
                      </div>
                      <div className={styles.userName}>{computer.session.userName}</div>
                      <div className={`${styles.timeLeft} ${styles[computer.session.status]}`}>
                        {computer.session.timeLeft}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.emptyComputer}>
                      <div className={styles.computerLabel}>Normal {computer.number}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* List View of Active Sessions */}
        {sessionViewMode === 'list' && (
          <div className={styles.activeSessionsSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionHeaderTitle}>Active Sessions</h2>
            </div>
            
            <div className={styles.sessionsListContainer}>
              {stats.activeSessions.length > 0 ? (
                <div className={styles.sessionsList}>
                  {/* Headers */}
                  <div className={`${styles.sessionItem} ${styles.headerRow}`}>
                    <div className={styles.sessionId}>Computer</div>
                    <div className={styles.sessionUsername}>Username</div>
                    <div className={styles.sessionTimeLeft}>Time Left</div>
                    <div className={styles.sessionStarted}>Started At</div>
                    <div className={styles.sessionActions}>Actions</div>
                  </div>
                  
                  {/* Session rows sorted by time left (low to high) */}
                  {[...stats.activeSessions]
                    .sort((a, b) => parseTimeLeftToMinutes(a.timeLeft) - parseTimeLeftToMinutes(b.timeLeft))
                    .map(session => {
                      // Skip sessions without host ID
                      if (!session.hostId) return null;
                      
                      const timeLeftStatus = getSessionStatus(session.timeLeft);
                      const computerType = getComputerType(session.hostId);
                      const computerNumber = getComputerNumber(session.hostId);
                      
                      return (
                        <div key={session.sessionId} className={styles.sessionItem}>
                          <div className={styles.sessionId}>
                            {computerType} {computerType === 'Normal' ? computerNumber % 8 || 8 : computerNumber % 6 || 6}
                            <div className={styles.sessionIdSubtext}>ID: {session.hostId}</div>
                          </div>
                          
                          <div className={styles.sessionUsername}>
                            {session.userName || `User ${session.userId}`}
                            <div className={styles.sessionIdSubtext}>UID: {session.userId}</div>
                          </div>
                          
                          <div className={`${styles.sessionTimeLeft} ${styles[timeLeftStatus]}`}>
                            {formatTimeLeft(session.timeLeft)}
                          </div>
                          
                          <div className={styles.sessionStarted}>
                            {new Date(session.timeStarted).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          
                          <div className={styles.sessionActions}>
                            {/* Future session actions would go here */}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className={styles.noSessionsMessage}>
                  {stats.loading ? 'Loading sessions...' : 'No active sessions'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
}
