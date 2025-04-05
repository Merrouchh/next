import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaUsers, FaDesktop, FaClock, FaTh, FaList, FaLaptop, FaCheck, FaUser, FaExclamationTriangle, FaSpinner, FaSync } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AdminDashboard.module.css';
import { fetchActiveUserSessions } from '../../utils/api';

// Add useInterval custom hook for auto-refresh
const useInterval = (callback, delay) => {
  const savedCallback = useRef();

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

// Add debugMode flag for controlling console logs
const debugMode = false;

// Update the debugging helper
const debugLog = (label, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${label}:`, data);
  }
};

// Add the computer data structures and helper functions after the toggleSessionViewMode function
// Computer data structures
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

// Helper function to get computer type
const getComputerType = (hostId) => {
  // VIP PCs: 20-25
  if ([20, 21, 22, 23, 24, 25].includes(Number(hostId))) {
    return 'VIP';
  }
  // Normal PCs: all others
  return 'Normal';
};

// Helper function to get computer number
const getComputerNumber = (hostId) => {
  // Map host IDs to computer numbers for display
  const computerMap = {
    26: 1, 12: 2, 8: 3, 5: 4, 17: 5, 11: 6, 16: 7, 14: 8, // Normal PCs
    21: 9, 22: 10, 25: 11, 20: 12, 24: 13, 23: 14 // VIP PCs
  };
  
  return computerMap[hostId] || hostId;
};

// Format the time left
const formatTimeLeft = (timeLeft) => {
  if (!timeLeft || timeLeft === 'No Time') return 'No Time';
  // If it's already in the right format, return it
  if (typeof timeLeft === 'string' && timeLeft.includes(':')) return timeLeft;
  // Otherwise, try to format it
  return timeLeft;
};

// Helper function to check session status based on time left
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
  
  // Return status based on total minutes
  const totalMinutes = hours * 60 + minutes;
  
  if (totalMinutes <= 0) return 'expired';
  if (totalMinutes < 60) return 'warning'; // Less than 1 hour
  if (totalMinutes < 120) return 'medium'; // Less than 2 hours
  return 'good'; // 2+ hours
};

// Helper function to parse time left into minutes for sorting
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

// Helper function to count computers with low time
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

// Function to prepare computers with session data
const prepareComputersWithSessionData = async (stats, supabase) => {
  // Deep clone the computers to avoid modifying the source
  const normalComputers = JSON.parse(JSON.stringify(allComputers.normal));
  const vipComputers = JSON.parse(JSON.stringify(allComputers.vip));
  
  // Mark all computers as available initially
  normalComputers.forEach(pc => pc.available = true);
  vipComputers.forEach(pc => pc.available = true);
  
  // Get mapping of gizmo_ids to account status
  const userAccountMap = {};
  
  // If there are active sessions, check which users have accounts
  if (stats.activeSessions.length > 0) {
    const gizmoIds = stats.activeSessions
      .filter(session => session.userId)
      .map(session => session.userId);
    
    if (gizmoIds.length > 0) {
      try {
        // Query the users table to see which gizmo_ids exist
        const { data, error } = await supabase
          .from('users')
          .select('gizmo_id')
          .in('gizmo_id', gizmoIds);
          
        if (data && !error) {
          // Create a map of gizmo_id to account status
          data.forEach(user => {
            userAccountMap[user.gizmo_id] = true;
          });
          
          debugLog('Users with accounts', userAccountMap);
        } else if (error) {
          console.error('Error checking user accounts:', error);
        }
      } catch (err) {
        console.error('Exception checking user accounts:', err);
      }
    }
  }
  
  // For each active session, find the matching computer and update it
  stats.activeSessions.forEach(session => {
    const computerType = getComputerType(session.hostId).toLowerCase();
    const computers = computerType === 'vip' ? vipComputers : normalComputers;
    
    // Find the computer that matches this session
    const computerIndex = computers.findIndex(pc => pc.hostId === session.hostId);
    
    if (computerIndex !== -1) {
      // Update the computer with session data
      computers[computerIndex] = {
        ...computers[computerIndex],
        available: false,
        userId: session.userId,
        userName: session.userName || `User ${session.userId}`,
        timeLeft: session.timeLeft || 'No Time',
        startTime: session.startTime,
        hasAccount: userAccountMap[session.userId] || false
      };
    }
  });
  
  return { 
    normalComputers, 
    vipComputers,
    // Sort VIP computers by number (1-6)
    sortedVipComputers: [...vipComputers].sort((a, b) => a.number - b.number),
    // Create arrays for the normal computer rows with specific ordering
    normalRow1: [7, 5, 3, 1].map(num => normalComputers.find(pc => pc.number === num)),
    normalRow2: [8, 6, 4, 2].map(num => normalComputers.find(pc => pc.number === num))
  };
};

// Add the ComputerGridView component
const ComputerGridView = ({ stats, getComputerType, formatTimeLeft, getSessionStatus, prepareComputersWithSessionData, router, supabase }) => {
  // Move useState hook outside of conditional rendering
  const [computerData, setComputerData] = React.useState({
    sortedVipComputers: [],
    normalRow1: [],
    normalRow2: []
  });
  
  // Move the useEffect hook outside of conditional rendering
  React.useEffect(() => {
    let isMounted = true;
    
    async function loadComputerData() {
      try {
        const data = await prepareComputersWithSessionData(stats, supabase);
        if (isMounted) {
          setComputerData(data);
        }
      } catch (error) {
        console.error("Error loading computer data:", error);
      }
    }
    
    loadComputerData();
    
    // Cleanup function to prevent setting state on unmounted component
    return () => {
      isMounted = false;
    };
  }, [stats.activeSessions, prepareComputersWithSessionData, supabase]);
  
  return (
    <>
      {/* Computer Summary */}
      <div className={styles.computerSummary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon} style={{ backgroundColor: 'rgba(52, 168, 83, 0.2)' }}>
            <FaDesktop style={{ color: '#34A853' }} />
          </div>
          <div>
            <div className={styles.summaryLabel}>Active Sessions</div>
            <div className={styles.summaryValue}>
              {stats.activeSessions.length}/14
            </div>
          </div>
        </div>
        
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon} style={{ backgroundColor: 'rgba(234, 67, 53, 0.2)' }}>
            <FaCheck style={{ color: '#EA4335' }} />
          </div>
          <div>
            <div className={styles.summaryLabel}>Availability</div>
            <div className={styles.summaryValue}>
              <>
                {8 - stats.activeSessions.filter(s => getComputerType(s.hostId) === 'Normal').length} Normal +{' '}
                {6 - stats.activeSessions.filter(s => getComputerType(s.hostId) === 'VIP').length} VIP
              </>
            </div>
          </div>
        </div>
        
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon} style={{ backgroundColor: 'rgba(255, 152, 0, 0.2)' }}>
            <FaClock style={{ color: '#FF9800' }} />
          </div>
          <div>
            <div className={styles.summaryLabel}>Low Time Left</div>
            <div className={styles.summaryValue}>
              {(() => {
                const lowTime = countLowTimeComputers(stats.activeSessions);
                return (
                  <>
                    {lowTime.normal} Normal + {lowTime.vip} VIP
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* VIP Section */}
      <div>
        <h3 className={styles.sectionHeader}>
          VIP Computers
          <span className={styles.sectionHeaderCount}>
            {stats.activeSessions.filter(s => getComputerType(s.hostId) === 'VIP').length} active
          </span>
        </h3>
        
        <div className={styles.computerGrid}>
          {computerData.sortedVipComputers.map(computer => {
            const timeStatus = computer.available ? 'available' : getSessionStatus(computer.timeLeft);
            
            return (
              <div 
                key={`vip-${computer.id}`}
                className={`${styles.computerCard} ${styles[timeStatus]}`}
              >
                <div className={styles.computerHeader}>
                  <div className={`${styles.computerIcon} ${styles.vip}`}>
                    <FaDesktop />
                  </div>
                  <div className={styles.computerName}>
                    VIP {computer.displayNumber || (computer.number + 8)}
                  </div>
                  {computer.available && 
                    <div className={styles.availableBadge}>Available</div>
                  }
                </div>
                
                <div className={styles.computerBody}>
                  {computer.available ? (
                    <div className={styles.emptyCardPlaceholder}>
                      No active session
                    </div>
                  ) : (
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>
                        <span className={styles.userInfoLabel}>User:</span>
                        <span>
                          {computer.userName}
                          {computer.hasAccount && (
                            <span className={styles.accountIndicator} title="User has website account">
                              <FaCheck size={10} />
                            </span>
                          )}
                        </span>
                      </div>
                      <div className={styles.timeInfo}>
                        <span className={styles.userInfoLabel}>Time Left:</span>
                        <span className={`${styles.timeValue} ${styles[timeStatus]}`}>
                          {formatTimeLeft(computer.timeLeft)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={styles.computerFooter}>
                  {computer.available ? (
                    <div className={styles.sessionIdSmall}>
                      Host ID: {computer.hostId}
                    </div>
                  ) : (
                    <>
                      <div className={styles.sessionIdSmall}>
                        Host ID: {computer.hostId} / User ID: {computer.userId}
                      </div>
                      <button 
                        className={styles.actionButton}
                        onClick={() => router.push(`/admin/users?id=${computer.userId}`)}
                        title="View user profile"
                      >
                        <FaUsers size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Normal Section */}
      <div>
        <h3 className={styles.sectionHeader}>
          Normal Computers
          <span className={styles.sectionHeaderCount}>
            {stats.activeSessions.filter(s => getComputerType(s.hostId) === 'Normal').length} active
          </span>
        </h3>
        <div className={styles.computerGridSpecial}>
          {computerData.normalRow1.map(computer => computer && (
            <div 
              key={`normal-${computer.id}`}
              className={`${styles.computerCard} ${styles[computer.available ? 'available' : getSessionStatus(computer.timeLeft)]}`}
            >
              <div className={styles.computerHeader}>
                <div className={`${styles.computerIcon} ${styles.normal}`}>
                  <FaDesktop />
                </div>
                <div className={styles.computerName}>
                  Normal {computer.number}
                </div>
                {computer.available && 
                  <div className={styles.availableBadge}>Available</div>
                }
              </div>
              
              <div className={styles.computerBody}>
                {computer.available ? (
                  <div className={styles.emptyCardPlaceholder}>
                    No active session
                  </div>
                ) : (
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>
                      <span className={styles.userInfoLabel}>User:</span>
                      <span>
                        {computer.userName}
                        {computer.hasAccount && (
                          <span className={styles.accountIndicator} title="User has website account">
                            <FaCheck size={10} />
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles.timeInfo}>
                      <span className={styles.userInfoLabel}>Time Left:</span>
                      <span className={`${styles.timeValue} ${styles[getSessionStatus(computer.timeLeft)]}`}>
                        {formatTimeLeft(computer.timeLeft)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className={styles.computerFooter}>
                {computer.available ? (
                  <div className={styles.sessionIdSmall}>
                    Host ID: {computer.hostId}
                  </div>
                ) : (
                  <>
                    <div className={styles.sessionIdSmall}>
                      Host ID: {computer.hostId} / User ID: {computer.userId}
                    </div>
                    <button 
                      className={styles.actionButton}
                      onClick={() => router.push(`/admin/users?id=${computer.userId}`)}
                      title="View user profile"
                    >
                      <FaUsers size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Second row: 8,6,4,2 */}
        <div className={styles.computerGridSpecial}>
          {computerData.normalRow2.map(computer => computer && (
            <div 
              key={`normal-${computer.id}`}
              className={`${styles.computerCard} ${styles[computer.available ? 'available' : getSessionStatus(computer.timeLeft)]}`}
            >
              <div className={styles.computerHeader}>
                <div className={`${styles.computerIcon} ${styles.normal}`}>
                  <FaDesktop />
                </div>
                <div className={styles.computerName}>
                  Normal {computer.number}
                </div>
                {computer.available && 
                  <div className={styles.availableBadge}>Available</div>
                }
              </div>
              
              <div className={styles.computerBody}>
                {computer.available ? (
                  <div className={styles.emptyCardPlaceholder}>
                    No active session
                  </div>
                ) : (
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>
                      <span className={styles.userInfoLabel}>User:</span>
                      <span>
                        {computer.userName}
                        {computer.hasAccount && (
                          <span className={styles.accountIndicator} title="User has website account">
                            <FaCheck size={10} />
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles.timeInfo}>
                      <span className={styles.userInfoLabel}>Time Left:</span>
                      <span className={`${styles.timeValue} ${styles[getSessionStatus(computer.timeLeft)]}`}>
                        {formatTimeLeft(computer.timeLeft)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className={styles.computerFooter}>
                {computer.available ? (
                  <div className={styles.sessionIdSmall}>
                    Host ID: {computer.hostId}
                  </div>
                ) : (
                  <>
                    <div className={styles.sessionIdSmall}>
                      Host ID: {computer.hostId} / User ID: {computer.userId}
                    </div>
                    <button 
                      className={styles.actionButton}
                      onClick={() => router.push(`/admin/users?id=${computer.userId}`)}
                      title="View user profile"
                    >
                      <FaUsers size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// Add the SessionListView component
const SessionListView = ({ stats, getComputerType, formatTimeLeft, getSessionStatus, router }) => {
  // Sort sessions by computer type (VIP first) and then by lowest time left
  const sortedSessions = React.useMemo(() => {
    if (!stats.activeSessions || stats.activeSessions.length === 0) return [];
    
    return [...stats.activeSessions].sort((a, b) => {
      // First by type (VIP first)
      const typeA = getComputerType(a.hostId);
      const typeB = getComputerType(b.hostId);
      
      if (typeA !== typeB) {
        return typeA === 'VIP' ? -1 : 1;
      }
      
      // Then by time left (lowest first)
      return parseTimeLeftToMinutes(a.timeLeft) - parseTimeLeftToMinutes(b.timeLeft);
    });
  }, [stats.activeSessions, getComputerType]);
  
  return (
    <div className={styles.sessionTableContainer}>
      <table className={styles.sessionTable}>
        <thead>
          <tr>
            <th>Computer</th>
            <th>User</th>
            <th>Time Left</th>
            <th>Start Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedSessions.length === 0 ? (
            <tr>
              <td colSpan="5" className={styles.emptyTableMessage}>
                No active sessions
              </td>
            </tr>
          ) : (
            sortedSessions.map((session) => {
              const computerType = getComputerType(session.hostId);
              const timeStatus = getSessionStatus(session.timeLeft);
              const computerNumber = getComputerNumber(session.hostId);
              
              return (
                <tr key={`session-${session.hostId}`} className={styles[timeStatus]}>
                  <td>
                    <div className={styles.computerCell}>
                      <span className={`${styles.computerBadge} ${styles[computerType.toLowerCase()]}`}>
                        {computerType}
                      </span>
                      <span className={styles.computerNumber}>#{computerNumber}</span>
                      <span className={styles.hostId}>(Host: {session.hostId})</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.userCell}>
                      {session.userName || `User ${session.userId}`}
                      <span className={styles.userId}>(ID: {session.userId})</span>
                    </div>
                  </td>
                  <td className={`${styles.timeCell} ${styles[timeStatus]}`}>
                    {formatTimeLeft(session.timeLeft)}
                  </td>
                  <td>{session.startTime || 'Unknown'}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.actionButton}
                        onClick={() => router.push(`/admin/users?id=${session.userId}`)}
                        title="View user profile"
                      >
                        <FaUser size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
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
  const abortControllerRef = useRef(null);

  // Function to fetch active sessions with their details
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
        
        // Fetch username using our dedicated API endpoint with gizmoId parameter
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
      
      // Check which users have accounts in the database
      const gizmoIds = enhancedSessions
        .filter(session => session.userId)
        .map(session => session.userId);
      
      if (gizmoIds.length > 0) {
        try {
          // Query the users table to see which gizmo_ids exist
          const { data, error } = await supabase
            .from('users')
            .select('gizmo_id')
            .in('gizmo_id', gizmoIds)
            .abortSignal(signal);
            
          if (data && !error) {
            // Create a map of gizmo_id to account status
            const userAccountMap = {};
            data.forEach(user => {
              userAccountMap[user.gizmo_id] = true;
            });
            
            // Update the sessions with account status
            enhancedSessions.forEach((session, index) => {
              if (session.userId && userAccountMap[session.userId]) {
                enhancedSessions[index].hasAccount = true;
              }
            });
            
            debugLog('Users with accounts', userAccountMap);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Exception checking user accounts:', err);
          }
        }
      }
      
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

  // Function to fetch session data
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
        loading: false
      }));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching session stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Set up auto-refresh with useInterval (every 5 seconds)
  useInterval(() => {
    // Only fetch if component is mounted and the tab is active
    if (document.visibilityState === 'visible') {
      fetchSessionStats();
    }
  }, 5000);

  // Initial data load
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

  // Cleanup effect for aborting requests
  useEffect(() => {
    return () => {
      // Abort any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Toggle view function
  const toggleSessionViewMode = () => {
    setSessionViewMode(prevMode => prevMode === 'list' ? 'grid' : 'list');
  };

  return (
    <AdminPageWrapper title="Session Management">
      <Head>
        <title>Session Management | Merrouch Gaming Center</title>
        <meta name="description" content="Manage active gaming sessions" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={styles.adminDashboard}>
        <section className={styles.statsSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleText}>Active Sessions</span>
            <span className={styles.sectionTitleLine}></span>
          </h2>
          
          <div className={styles.computerViewControls}>
            <div className={styles.viewToggle}>
              <button 
                className={`${styles.viewToggleButton} ${sessionViewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setSessionViewMode('grid')}
                title="Grid View"
              >
                <FaTh />
              </button>
              <button 
                className={`${styles.viewToggleButton} ${sessionViewMode === 'list' ? styles.active : ''}`}
                onClick={() => setSessionViewMode('list')}
                title="List View"
              >
                <FaList />
              </button>
            </div>
            <button 
              className={styles.refreshButton}
              onClick={fetchSessionStats}
              disabled={stats.loading}
            >
              {stats.loading ? <FaSpinner className={styles.spinner} /> : <FaSync />}
              {stats.loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          <div className={styles.computersContainer}>
            {stats.loading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}>
                  <FaSpinner className={styles.spinnerIcon} />
                </div>
                <p>Loading sessions...</p>
              </div>
            ) : stats.activeSessions.length === 0 ? (
              <div className={styles.noSessionsMessage}>
                <p>No active gaming sessions at this time</p>
              </div>
            ) : sessionViewMode === 'list' ? (
              <SessionListView
                stats={stats}
                getComputerType={getComputerType}
                formatTimeLeft={formatTimeLeft}
                getSessionStatus={getSessionStatus}
                router={router}
              />
            ) : (
              <div className={styles.sessionsGridLayout}>
                <ComputerGridView
                  stats={stats}
                  getComputerType={getComputerType}
                  formatTimeLeft={formatTimeLeft}
                  getSessionStatus={getSessionStatus}
                  prepareComputersWithSessionData={prepareComputersWithSessionData}
                  router={router}
                  supabase={supabase}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminPageWrapper>
  );
} 