import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  FaUsers, FaDesktop, FaClock, FaChartBar, FaTimes, FaTh, 
  FaList, FaLaptop, FaCheck 
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AdminDashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';
import { fetchActiveUserSessions } from '../../utils/api';

// Custom useInterval hook for polling
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

// Debug mode flag
const debugMode = false;

// Debug log helper
const debugLog = (message, data) => {
  if (debugMode) {
    console.log(`[DEBUG] ${message}:`, data);
  }
};

// ComputerGridView component for the grid display
const ComputerGridView = ({ stats, getComputerType, formatTimeLeft, getSessionStatus, prepareComputersWithSessionData, router }) => {
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
        const data = await prepareComputersWithSessionData();
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
  }, [stats.activeSessions, prepareComputersWithSessionData]);
  
  return (
    <>
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

export default function SessionsPage() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    activeSessions: [],
    loading: true
  });
  const [sessionViewMode, setSessionViewMode] = useState('grid'); // 'list' or 'grid'
  
  // AbortController reference for cleanup
  const abortControllerRef = React.useRef(null);

  // Format the session count
  const formatSessionCount = (activeCount) => {
    const totalCapacity = 14;
    return `${activeCount}/${totalCapacity}`;
  };

  // Get computer type from ID
  const getComputerType = (computerId) => {
    // Computer IDs from avcomputers.js
    const normalComputers = [26, 12, 8, 5, 17, 11, 16, 14];
    const vipComputers = [21, 22, 25, 20, 24, 23];
    
    if (vipComputers.includes(computerId)) return 'VIP';
    if (normalComputers.includes(computerId)) return 'Normal';
    return computerId <= 8 ? 'Normal' : 'VIP'; // Fallback based on ID
  };

  // Get computer number from ID
  const getComputerNumber = (computerId) => {
    // Mapping from avcomputers.js
    const computerMap = {
      26: 1, 12: 2, 8: 3, 5: 4, 17: 5, 11: 6, 16: 7, 14: 8, // Normal PCs
      21: 9, 22: 10, 25: 11, 20: 12, 24: 13, 23: 14 // VIP PCs
    };
    
    return computerMap[computerId] || computerId;
  };

  // Toggle view mode between grid and list
  const toggleSessionViewMode = () => {
    setSessionViewMode(prevMode => prevMode === 'list' ? 'grid' : 'list');
  };

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

  // Formatting functions
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
    
    if (totalMinutes < 60) return 'warning'; // Less than 1 hour
    return 'active'; // More than 1 hour
  };

  // Helper function to count low time computers
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

  // Parse time left to minutes for sorting
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

  // Fetch username by Gizmo ID
  const fetchUsernameByGizmoId = async (gizmoId) => {
    try {
      debugLog(`Fetching username for gizmo_id`, gizmoId);
      
      // First try to get username from Gizmo API
      try {
        // Use the fetchuserdata endpoint to get user info
        const response = await fetch(`/api/fetchuserdata/${gizmoId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          debugLog(`User data from API for ${gizmoId}`, data);
          
          if (data && data.username) {
            return data.username;
          }
          
          if (data && data.result && data.result.name) {
            return data.result.name;
          }
        }
      } catch (apiError) {
        console.error(`API error fetching username for ${gizmoId}:`, apiError);
      }
      
      // Alternative: Try fetching from the user info endpoint
      try {
        const userResponse = await fetch(`/api/users/info/${gizmoId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          debugLog(`User info for ${gizmoId}`, userData);
          
          if (userData && userData.username) {
            return userData.username;
          }
          
          if (userData && userData.name) {
            return userData.name;
          }
        }
      } catch (userApiError) {
        console.error(`User API error for ${gizmoId}:`, userApiError);
      }
      
      return null;
    } catch (error) {
      console.error('Exception in fetchUsernameByGizmoId:', error);
      return null;
    }
  };
  
  // Fetch active sessions with details
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

  // Replace the prepareComputersWithSessionData function to include account verification
  const prepareComputersWithSessionData = async () => {
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

  // Function to fetch session data
  const fetchSessionData = async () => {
    if (!user) return;
    
    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;
      
      // Get active sessions with time details
      const sessionsWithDetails = await fetchActiveSessionsWithDetails(signal);
      
      // Update stats without changing loading state for refresh
      setStats(prev => ({
        activeSessions: sessionsWithDetails || prev.activeSessions,
        loading: false // Always set loading to false
      }));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching session data:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Set up auto-refresh with useInterval
  useInterval(() => {
    // Only fetch if component is mounted and the tab is active
    if (document.visibilityState === 'visible') {
      fetchSessionData();
    }
  }, 5000);

  // Initial data fetch
  useEffect(() => {
    // Only set loading to true for the initial fetch
    setStats(prev => ({ ...prev, loading: true }));
    
    // Fetch initial data
    fetchSessionData();
    
    // Set a timeout to ensure loading state is cleared even if fetch fails
    const timer = setTimeout(() => {
      setStats(prev => ({ ...prev, loading: false }));
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [user, supabase]);

  // Add cleanup effect for network requests
  useEffect(() => {
    return () => {
      // Abort any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <AdminPageWrapper title="Session Management">
      <Head>
        <title>Session Management | Merrouch Gaming Center</title>
        <meta name="description" content="Monitor and manage active gaming sessions" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={styles.adminDashboard}>
        <section className={styles.statsSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleText}>Session Overview</span>
            <span className={styles.sectionTitleLine}></span>
          </h2>
          
          <div className={styles.computerSummary}>
            <div className={styles.summaryItem}>
              <div className={styles.summaryIcon} style={{ backgroundColor: 'rgba(52, 168, 83, 0.2)' }}>
                <FaDesktop style={{ color: '#34A853' }} />
              </div>
              <div>
                <div className={styles.summaryLabel}>Active Sessions</div>
                <div className={styles.summaryValue}>
                  {formatSessionCount(stats.activeSessions.length)}
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
        </section>
        
        <section className={styles.computersSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleText}>Computer Status</span>
            <span className={styles.sectionTitleLine}></span>
          </h2>
          
          <div className={styles.computerViewToggle}>
            <button 
              className={`${styles.viewTypeButton} ${sessionViewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setSessionViewMode('grid')}
            >
              <FaTh size={14} /> Grid View
            </button>
            
            {stats.activeSessions.length > 0 && (
              <button 
                className={`${styles.viewTypeButton} ${sessionViewMode === 'list' ? styles.active : ''}`}
                onClick={() => setSessionViewMode('list')}
              >
                <FaList size={14} /> List View
              </button>
            )}
            
            <div style={{ marginLeft: 'auto' }}>
              <small className={styles.liveUpdatingText}>
                <span className={styles.liveDot}></span> Live updating
              </small>
            </div>
          </div>
          
          {stats.activeSessions.length === 0 && !stats.loading && sessionViewMode === 'list' ? (
            <div className={styles.noSessionsMessage}>
              <p>No active gaming sessions at this time</p>
            </div>
          ) : sessionViewMode === 'list' ? (
            <div className={styles.darkSessionsList}>
              {stats.activeSessions
                .map((session, index) => ({
                  ...session,
                  index, // Keep original index for stable sorting
                  timeLeftMinutes: parseTimeLeftToMinutes(session.timeLeft || session.time_left)
                }))
                .sort((a, b) => a.timeLeftMinutes - b.timeLeftMinutes) // Sort by time left (ascending)
                .map((session) => {
                  // Basic session info
                  const sessionInfo = {
                    id: session.id || session.index,
                    userId: session.userId,
                    hostId: session.hostId,
                    userName: session.userName || session.user_name || null,
                    timeLeft: session.timeLeft || session.time_left || null,
                    startTime: session.startTime || session.start_time || null,
                    hasAccount: session.hasAccount || false
                  };
                  
                  // Get computer details
                  const computerType = getComputerType(sessionInfo.hostId);
                  const computerNumber = getComputerNumber(sessionInfo.hostId);
                  
                  // Format the time display
                  const formattedTimeLeft = formatTimeLeft(sessionInfo.timeLeft) || 'No Time';
                  const timeStatus = getSessionStatus(sessionInfo.timeLeft);
                  
                  // Get display username with fallback
                  const displayName = sessionInfo.userName || `User ${sessionInfo.userId}`;
                  
                  return (
                    <div 
                      key={sessionInfo.id} 
                      className={`${styles.darkSessionItem} ${styles[timeStatus]}`}
                    >
                      <div className={`${styles.sessionComputer} ${styles[computerType.toLowerCase()]}`}>
                        <FaDesktop />
                        <span>{computerType} {computerNumber}</span>
                      </div>
                      <div className={styles.sessionInfo}>
                        <div className={styles.sessionUser}>
                          <strong>User:</strong> 
                          {displayName}
                          {sessionInfo.hasAccount && (
                            <span className={styles.accountIndicator} title="User has website account">
                              <FaCheck size={10} />
                            </span>
                          )}
                        </div>
                        <div className={`${styles.sessionTime} ${styles[timeStatus]}`}>
                          <strong>Time Left:</strong> {formattedTimeLeft}
                        </div>
                        {sessionInfo.startTime && (
                          <div className={styles.sessionStart}>
                            <strong>Started:</strong> {new Date(sessionInfo.startTime).toLocaleTimeString()}
                          </div>
                        )}
                        <div className={styles.sessionId}>
                          <small>Host ID: {sessionInfo.hostId} / User ID: {sessionInfo.userId}</small>
                        </div>
                      </div>
                      <div className={styles.sessionActions}>
                        <button 
                          className={styles.viewUserButton}
                          onClick={() => router.push(`/admin/users?id=${sessionInfo.userId}`)}
                          title="View user profile"
                        >
                          <FaUsers />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className={styles.sessionsGridLayout}>
              <ComputerGridView
                stats={stats}
                getComputerType={getComputerType}
                formatTimeLeft={formatTimeLeft}
                getSessionStatus={getSessionStatus}
                prepareComputersWithSessionData={prepareComputersWithSessionData}
                router={router}
              />
            </div>
          )}
        </section>
      </div>
    </AdminPageWrapper>
  );
}
