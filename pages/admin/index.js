import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaUsers, FaCalendarAlt, FaDesktop, FaClock, FaChartBar, FaBell, FaTimes, FaTh, FaList, FaLaptop, FaCheck } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AdminDashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';
import { fetchActiveUserSessions, fetchTopUsers } from '../../utils/api';

// Add a custom useInterval hook for polling
function useInterval(callback, delay) {
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
}

export default function AdminDashboard() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalEvents: 0,
    activeSessions: [],
    loading: true
  });
  const [showActiveSessionsModal, setShowActiveSessionsModal] = useState(false);
  const [sessionViewMode, setSessionViewMode] = useState('grid'); // 'list' or 'grid'
  const [lastUpdated, setLastUpdated] = useState(null);

  // Replace the username fetching function to use only API endpoints
  const fetchUsernameByGizmoId = async (gizmoId) => {
    try {
      console.log(`Fetching username for gizmo_id: ${gizmoId}`);
      
      // First try to get username from Gizmo API
      try {
        // Use the fetchuserdata endpoint to get user info
        const response = await fetch(`/api/fetchuserdata/${gizmoId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`User data from API for ${gizmoId}:`, data);
          
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
          console.log(`User info for ${gizmoId}:`, userData);
          
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

  // Update the fetchActiveSessionsWithDetails function to use the new API endpoint
  const fetchActiveSessionsWithDetails = async () => {
    try {
      // First, get the basic active sessions
      const activeSessions = await fetchActiveUserSessions();
      
      // If no sessions, return empty array
      if (!activeSessions || activeSessions.length === 0) {
        return [];
      }
      
      console.log('Basic active sessions:', activeSessions);
      
      // Create a copy to work with
      const enhancedSessions = [...activeSessions];
      
      // For each session, fetch username and time left in parallel
      await Promise.all(enhancedSessions.map(async (session, index) => {
        if (!session.userId) return;
        
        // Fetch username using our new dedicated API endpoint with gizmoId parameter
        try {
          const userResponse = await fetch(`/api/users/${session.userId}/username`, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log(`Username API response for ${session.userId}:`, userData);
            
            if (userData && userData.success && userData.username) {
              enhancedSessions[index].userName = userData.username;
            } else {
              console.log(`No username found for user ${session.userId}`);
              enhancedSessions[index].userName = `User ${session.userId}`;
            }
          }
        } catch (userError) {
          console.error(`Error fetching username for ${session.userId}:`, userError);
          enhancedSessions[index].userName = `User ${session.userId}`;
        }
        
        // Fetch time left
        try {
          const balanceResponse = await fetch(`/api/fetchuserbalance/${session.userId}`, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            enhancedSessions[index].timeLeft = balanceData.balance || 'No Time';
          }
        } catch (error) {
          console.error(`Error fetching balance for session ${index}:`, error);
        }
      }));
      
      // Log the final enhanced sessions
      console.log('Final enhanced sessions with usernames:', enhancedSessions);
      
      return enhancedSessions;
    } catch (error) {
      console.error('Error in fetchActiveSessionsWithDetails:', error);
      return [];
    }
  };

  // Refactor fetchAdminStats into a callback that can be used by the interval
  const fetchAdminStats = useCallback(async () => {
    if (!user) return;
    
    try {
      // Don't set loading to true for automatic refreshes to avoid UI flicker
      const isManualRefresh = !lastUpdated;
      if (isManualRefresh) {
        setStats(prev => ({ ...prev, loading: true }));
      }
      
      // Get active sessions with time details
      const sessionsWithDetails = await fetchActiveSessionsWithDetails();
      
      // Get session for auth
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Get events count
      const { count: eventsCount, error: eventsError } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true });
        
      if (eventsError) {
        console.error('Error fetching events count:', eventsError);
      }
      
      // Get users count
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
        
      if (usersError) {
        console.error('Error fetching users count:', usersError);
      }
      
      // Get active users (users with activity in the last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { count: activeUsersCount, error: activeUsersError } = await supabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gt('created_at', oneDayAgo.toISOString());
        
      if (activeUsersError) {
        console.error('Error fetching active users count:', activeUsersError);
      }
      
      setStats({
        totalUsers: usersCount || 0,
        activeUsers: activeUsersCount || 0,
        totalEvents: eventsCount || 0,
        activeSessions: sessionsWithDetails || [],
        loading: false
      });
      
      // Update the last refreshed timestamp
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, [user, supabase, lastUpdated]);
  
  // Use interval to automatically refresh data every 5 seconds
  useInterval(() => {
    fetchAdminStats();
  }, 5000);
  
  // Initial data load
  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  // Format the last updated time as a readable string
  const getLastUpdatedString = () => {
    if (!lastUpdated) return 'Loading...';
    
    return `Live data • Last updated: ${lastUpdated.toLocaleTimeString()}`;
  };

  // Format the session count similar to dashboard.js
  const formatSessionCount = (activeCount) => {
    const totalCapacity = 14;
    return `${activeCount}/${totalCapacity}`;
  };

  // Admin features with icons and descriptions
  const adminFeatures = [
    {
      title: 'User Management',
      icon: <FaUsers className={styles.featureIcon} />,
      description: 'Manage user accounts, view profiles, and adjust permissions.',
      action: () => router.push('/admin/users'),
      color: '#4285F4' // Blue
    },
    {
      title: 'Event Management',
      icon: <FaCalendarAlt className={styles.featureIcon} />,
      description: 'Create, edit, and manage gaming events and tournaments.',
      action: () => router.push('/admin/events'),
      color: '#EA4335' // Red
    },
    {
      title: 'Session Management',
      icon: <FaDesktop className={styles.featureIcon} />,
      description: 'Monitor active gaming sessions and computer usage.',
      action: () => router.push('/admin/sessions'),
      color: '#34A853' // Green
    },
    {
      title: 'Statistics',
      icon: <FaChartBar className={styles.featureIcon} />,
      description: 'View detailed analytics and reports about your gaming center.',
      action: () => router.push('/admin/stats'),
      color: '#FBBC05' // Yellow
    },
    {
      title: 'Scheduled Tasks',
      icon: <FaClock className={styles.featureIcon} />,
      description: 'Set up automated tasks and scheduled events.',
      action: () => router.push('/admin/tasks'),
      color: '#9C27B0' // Purple
    },
    {
      title: 'Notifications',
      icon: <FaBell className={styles.featureIcon} />,
      description: 'Send announcements and notifications to users.',
      action: () => router.push('/admin/notifications'),
      color: '#FF9800' // Orange
    }
  ];

  // Completely rewrite the fetchDetailedSessionInfo function to handle data more directly
  const fetchDetailedSessionInfo = async (sessions) => {
    if (!sessions || sessions.length === 0) return [];
    
    // Create a copy of the sessions array to avoid mutating the original
    const detailedSessions = [...sessions];
    
    // Early debug log
    console.log('Original sessions from API:', detailedSessions);
    
    // Process each session to extract and normalize data
    detailedSessions.forEach((session, index) => {
      // Format data from the API into a consistent structure
      detailedSessions[index] = {
        // Keep original data
        ...session,
        // Normalize user info
        userName: session.userName || session.user_name || session.username || null,
        // Normalize time info
        timeLeft: session.timeLeft || session.time_left || null
      };
    });
    
    // For sessions without a username, fetch it directly from the database
    const fetchPromises = detailedSessions
      .filter(session => !session.userName && session.userId)
      .map(async (session, index) => {
        const sessionIndex = detailedSessions.findIndex(s => s.userId === session.userId);
        if (sessionIndex === -1) return;
        
        try {
          // Try to get username from directly from user data with gizmoId parameter
          const usernameResponse = await fetch(`/api/users/${session.userId}/username`, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (usernameResponse.ok) {
            const userData = await usernameResponse.json();
            if (userData && userData.username) {
              detailedSessions[sessionIndex].userName = userData.username;
            }
          }
          
          // Always fetch the balance for fresh time data
          const balanceResponse = await fetch(`/api/fetchuserbalance/${session.userId}`, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            if (balanceData && balanceData.balance) {
              detailedSessions[sessionIndex].timeLeft = balanceData.balance;
            }
          }
        } catch (error) {
          console.error(`Error fetching details for user ${session.userId}:`, error);
        }
      });
      
    try {
      // Wait for all fetch operations to complete
      await Promise.all(fetchPromises);
      
      // Final log of enhanced session data
      console.log('Enhanced session data:', detailedSessions);
      return detailedSessions;
    } catch (error) {
      console.error('Error while enhancing session data:', error);
      return detailedSessions;
    }
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
    
    if (totalMinutes < 60) return 'warning'; // Less than 1 hour
    return 'active'; // More than 1 hour
  };

  const getComputerType = (computerId) => {
    // Computer IDs from avcomputers.js
    const normalComputers = [26, 12, 8, 5, 17, 11, 16, 14];
    const vipComputers = [21, 22, 25, 20, 24, 23];
    
    if (vipComputers.includes(computerId)) return 'VIP';
    if (normalComputers.includes(computerId)) return 'Normal';
    return computerId <= 8 ? 'Normal' : 'VIP'; // Fallback based on ID
  };

  const getComputerNumber = (computerId) => {
    // Mapping from avcomputers.js
    const computerMap = {
      26: 1, 12: 2, 8: 3, 5: 4, 17: 5, 11: 6, 16: 7, 14: 8, // Normal PCs
      21: 9, 22: 10, 25: 11, 20: 12, 24: 13, 23: 14 // VIP PCs
    };
    
    return computerMap[computerId] || computerId;
  };

  // Add this to the component
  useEffect(() => {
    console.log('Active sessions data:', stats.activeSessions);
  }, [stats.activeSessions]);

  // Add a debugging helper
  const debugLog = (message, data) => {
    console.log(`[DEBUG] ${message}:`, data);
  };

  // Add a toggleView function
  const toggleSessionViewMode = () => {
    setSessionViewMode(prevMode => prevMode === 'list' ? 'grid' : 'list');
  };

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
      type: 'vip'
    }))
  };

  // Add a function to prepare computers with session data
  const prepareComputersWithSessionData = () => {
    // Deep clone the computers to avoid modifying the source
    const normalComputers = JSON.parse(JSON.stringify(allComputers.normal));
    const vipComputers = JSON.parse(JSON.stringify(allComputers.vip));
    
    // Mark all computers as available initially
    normalComputers.forEach(pc => pc.available = true);
    vipComputers.forEach(pc => pc.available = true);
    
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
          startTime: session.startTime
        };
      }
    });
    
    return { normalComputers, vipComputers };
  };

  return (
    <AdminPageWrapper title="Admin Dashboard">
      <Head>
        <title>Admin Dashboard | Merrouch Gaming Center</title>
        <meta name="description" content="Admin control panel for Merrouch Gaming Center" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={styles.adminDashboard}>
        <section className={styles.statsSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleText}>Overview</span>
            <span className={styles.sectionTitleLine}></span>
          </h2>
          
          <div className={styles.liveDataIndicator}>
            <div className={styles.liveDot}></div>
            <span>{getLastUpdatedString()}</span>
          </div>
          
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(66, 133, 244, 0.2)' }}>
                <FaUsers style={{ color: '#4285F4' }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statTitle}>Total Users</div>
                <div className={styles.statValue}>
                  {stats.loading ? <div className={styles.statLoading}></div> : stats.totalUsers}
                </div>
                <div className={styles.statSubtext}>Registered accounts</div>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(234, 67, 53, 0.2)' }}>
                <FaCalendarAlt style={{ color: '#EA4335' }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statTitle}>Events</div>
                <div className={styles.statValue}>
                  {stats.loading ? <div className={styles.statLoading}></div> : stats.totalEvents}
                </div>
                <div className={styles.statSubtext}>Total events</div>
              </div>
            </div>
            
            <div
              className={`${styles.statCard}`}
            >
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(52, 168, 83, 0.2)' }}>
                <FaDesktop style={{ color: '#34A853' }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statTitle}>Active Sessions</div>
                <div className={styles.statValue}>
                  {stats.loading ? <div className={styles.statLoading}></div> : formatSessionCount(stats.activeSessions.length)}
                </div>
                <div className={styles.statSubtext}>Computers in use</div>
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(251, 188, 5, 0.2)' }}>
                <FaUsers style={{ color: '#FBBC05' }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statTitle}>Active Users</div>
                <div className={styles.statValue}>
                  {stats.loading ? <div className={styles.statLoading}></div> : stats.activeUsers}
                </div>
                <div className={styles.statSubtext}>In the last 24 hours</div>
              </div>
            </div>
          </div>
        </section>
        
        <section className={styles.computersSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleText}>Computer Status</span>
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
                  {stats.loading ? '...' : formatSessionCount(stats.activeSessions.length)}
                </div>
              </div>
            </div>
            
            <div className={styles.summaryItem}>
              <div className={styles.summaryIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.2)' }}>
                <FaLaptop style={{ color: '#9C27B0' }} />
              </div>
              <div>
                <div className={styles.summaryLabel}>VIP Computers</div>
                <div className={styles.summaryValue}>
                  {stats.loading ? '...' : `${stats.activeSessions.filter(s => getComputerType(s.hostId) === 'VIP').length}/6`}
                </div>
              </div>
            </div>
            
            <div className={styles.summaryItem}>
              <div className={styles.summaryIcon} style={{ backgroundColor: 'rgba(66, 133, 244, 0.2)' }}>
                <FaLaptop style={{ color: '#4285F4' }} />
              </div>
              <div>
                <div className={styles.summaryLabel}>Normal Computers</div>
                <div className={styles.summaryValue}>
                  {stats.loading ? '...' : `${stats.activeSessions.filter(s => getComputerType(s.hostId) === 'Normal').length}/8`}
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
                  {stats.loading ? (
                    '...'
                  ) : (
                    <>
                      {8 - stats.activeSessions.filter(s => getComputerType(s.hostId) === 'Normal').length} Normal +{' '}
                      {6 - stats.activeSessions.filter(s => getComputerType(s.hostId) === 'VIP').length} VIP
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.computerViewToggle}>
            <button 
              className={`${styles.viewTypeButton} ${sessionViewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setSessionViewMode('grid')}
            >
              <FaTh size={14} /> Grid View
            </button>
            <button 
              className={`${styles.viewTypeButton} ${sessionViewMode === 'list' ? styles.active : ''}`}
              onClick={() => setSessionViewMode('list')}
            >
              <FaList size={14} /> List View
            </button>
          </div>
          
          {stats.activeSessions.length === 0 && !stats.loading ? (
            <div className={styles.noSessionsMessage}>
              <p>No active gaming sessions at this time</p>
            </div>
          ) : sessionViewMode === 'list' ? (
            <div className={styles.darkSessionsList}>
              {stats.activeSessions.map((session, index) => {
                // Basic session info
                const sessionInfo = {
                  id: session.id || index,
                  userId: session.userId,
                  hostId: session.hostId,
                  userName: session.userName || session.user_name || null,
                  timeLeft: session.timeLeft || session.time_left || null,
                  startTime: session.startTime || session.start_time || null
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
                        <strong>User:</strong> {displayName}
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
              {(() => {
                const { normalComputers, vipComputers } = prepareComputersWithSessionData();
                
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
                        {vipComputers.map(computer => {
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
                                  VIP {computer.number}
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
                                      <span>{computer.userName}</span>
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
                              
                              {!computer.available && (
                                <div className={styles.computerFooter}>
                                  <div className={styles.sessionIdSmall}>
                                    User ID: {computer.userId}
                                  </div>
                                  <button 
                                    className={styles.actionButton}
                                    onClick={() => router.push(`/admin/users?id=${computer.userId}`)}
                                    title="View user profile"
                                  >
                                    <FaUsers size={12} />
                                  </button>
                                </div>
                              )}
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
                      <div className={styles.computerGrid}>
                        {normalComputers.map(computer => {
                          const timeStatus = computer.available ? 'available' : getSessionStatus(computer.timeLeft);
                          
                          return (
                            <div 
                              key={`normal-${computer.id}`}
                              className={`${styles.computerCard} ${styles[timeStatus]}`}
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
                                      <span>{computer.userName}</span>
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
                              
                              {!computer.available && (
                                <div className={styles.computerFooter}>
                                  <div className={styles.sessionIdSmall}>
                                    User ID: {computer.userId}
                                  </div>
                                  <button 
                                    className={styles.actionButton}
                                    onClick={() => router.push(`/admin/users?id=${computer.userId}`)}
                                    title="View user profile"
                                  >
                                    <FaUsers size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </section>
        
        <section className={styles.featuresSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleText}>Admin Features</span>
            <span className={styles.sectionTitleLine}></span>
          </h2>
          
          <div className={styles.featuresGrid}>
            {adminFeatures.map((feature, index) => (
              <div key={index} className={styles.featureCard} onClick={feature.action}>
                <div className={styles.featureIconContainer} style={{ backgroundColor: `${feature.color}20` }}>
                  <span style={{ color: feature.color }}>{feature.icon}</span>
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
                <button className={styles.featureButton}>
                  Manage
                </button>
              </div>
            ))}
          </div>
        </section>
        
        <section className={styles.quickActionsSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleText}>Quick Actions</span>
            <span className={styles.sectionTitleLine}></span>
          </h2>
          
          <div className={styles.quickActionsGrid}>
            <button 
              className={`${sharedStyles.primaryButton} ${styles.quickActionButton}`}
              onClick={() => router.push('/admin/events?action=create')}
            >
              Create Event
            </button>
            
            <button 
              className={`${sharedStyles.primaryButton} ${styles.quickActionButton}`}
              onClick={() => router.push('/admin/users?action=create')}
            >
              Add User
            </button>
            
            <button 
              className={`${sharedStyles.primaryButton} ${styles.quickActionButton}`}
              onClick={() => router.push('/dashboard')}
            >
              View Dashboard
            </button>
            
            <button 
              className={`${sharedStyles.primaryButton} ${styles.quickActionButton}`}
              onClick={() => router.push('/admin/reports')}
            >
              Generate Reports
            </button>
          </div>
        </section>
      </div>
    </AdminPageWrapper>
  );
} 