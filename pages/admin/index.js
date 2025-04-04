import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaUsers, FaCalendarAlt, FaDesktop, FaClock, FaChartBar, FaBell, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AdminDashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';
import { fetchActiveUserSessions, fetchTopUsers } from '../../utils/api';

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

  useEffect(() => {
    // Fetch basic stats for the admin dashboard
    const fetchAdminStats = async () => {
      if (!user) return;
      
      try {
        setStats(prev => ({ ...prev, loading: true }));
        
        // Get active sessions using the same function as dashboard.js
        const activeSessions = await fetchActiveUserSessions();
        console.log('Basic active sessions:', activeSessions);
        
        // Fetch detailed information for each session
        const detailedSessions = await fetchDetailedSessionInfo(activeSessions);
        console.log('Detailed sessions:', detailedSessions);
        
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
          activeSessions: detailedSessions || [],
          loading: false
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };
    
    fetchAdminStats();
  }, [user, supabase]);

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

  // Add a function to fetch detailed information for each active session
  const fetchDetailedSessionInfo = async (sessions) => {
    if (!sessions || sessions.length === 0) return [];
    
    try {
      // Create a copy of the sessions array to avoid mutating the original
      const detailedSessions = [...sessions];
      
      // Fetch detailed information for each session
      await Promise.all(detailedSessions.map(async (session, index) => {
        if (!session.userId) return;
        
        try {
          // Fetch user details from the Supabase profiles table
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('gizmo_id', session.userId)
            .single();
          
          if (userData) {
            detailedSessions[index].userName = userData.display_name || userData.username;
          }
          
          // If we don't have time left info, try to fetch it
          if (!session.time_left && !session.timeLeft) {
            const response = await fetch(`/api/users/${session.userId}/balance`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
              const balanceData = await response.json();
              detailedSessions[index].timeLeft = balanceData.balance || 'No Time';
            }
          }
        } catch (error) {
          console.error(`Error fetching details for session ${index}:`, error);
        }
      }));
      
      return detailedSessions;
    } catch (error) {
      console.error('Error fetching detailed session info:', error);
      return sessions;
    }
  };

  // Update the handleRefresh function to use the new detailed session info
  const handleRefresh = async () => {
    setStats(prev => ({ ...prev, loading: true }));
    try {
      // Get active sessions
      const activeSessions = await fetchActiveUserSessions();
      
      // Fetch detailed information for each session
      const detailedSessions = await fetchDetailedSessionInfo(activeSessions);
      console.log('Detailed sessions:', detailedSessions);
      
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
        activeSessions: detailedSessions || [],
        loading: false
      });
    } catch (error) {
      console.error('Error refreshing admin stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
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
              className={`${styles.statCard} ${styles.clickableStatCard}`}
              onClick={() => setShowActiveSessionsModal(true)}
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
                <div className={styles.viewDetailsLink}>Click to view details</div>
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
          <div className={styles.refreshButtonContainer}>
            <button 
              onClick={handleRefresh}
              disabled={stats.loading}
              className={`${sharedStyles.primaryButton} ${styles.refreshButton}`}
            >
              <FaDesktop className={sharedStyles.buttonIcon} />
              {stats.loading ? 'Refreshing...' : 'Refresh Stats'}
            </button>
          </div>
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

      {/* Active Sessions Modal */}
      {showActiveSessionsModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Active Computer Sessions</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowActiveSessionsModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className={styles.liveIndicatorContainer}>
              <div className={styles.liveIndicator}>
                <div className={styles.liveDot}></div>
                <span className={styles.liveText}>Live</span>
              </div>
            </div>
            
            <div className={styles.modalBody}>
              {stats.activeSessions.length === 0 ? (
                <div className={styles.noSessions}>
                  <p>No active sessions at this time</p>
                </div>
              ) : (
                <div className={styles.sessionsList}>
                  {stats.activeSessions.map((session, index) => {
                    const computerType = getComputerType(session.hostId);
                    const computerNumber = getComputerNumber(session.hostId);
                    const timeStatus = getSessionStatus(session.time_left || session.timeLeft);
                    
                    // Debug each session
                    console.log('Session data:', {
                      computerType,
                      computerNumber,
                      timeStatus,
                      hostId: session.hostId,
                      userId: session.userId,
                      userName: session.user_name || session.userName,
                      timeLeft: session.time_left || session.timeLeft
                    });
                    
                    return (
                      <div 
                        key={index} 
                        className={`${styles.sessionItem} ${styles[timeStatus]}`}
                      >
                        <div className={`${styles.sessionComputer} ${styles[computerType.toLowerCase()]}`}>
                          <FaDesktop />
                          <span>{computerType} PC {computerNumber}</span>
                        </div>
                        <div className={styles.sessionInfo}>
                          <div className={styles.sessionUser}>
                            <strong>User:</strong> {session.user_name || session.userName || session.userId || "Unknown"}
                          </div>
                          <div className={`${styles.sessionTime} ${styles[timeStatus]}`}>
                            <strong>Time Left:</strong> {formatTimeLeft(session.time_left || session.timeLeft)}
                          </div>
                          {(session.start_time || session.startTime) && (
                            <div className={styles.sessionStart}>
                              <strong>Started:</strong> {new Date(session.start_time || session.startTime).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                        <div className={styles.sessionActions}>
                          <button 
                            className={styles.viewUserButton}
                            onClick={() => router.push(`/admin/users?id=${session.userId}`)}
                            title="View user profile"
                          >
                            <FaUsers />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.refreshButton}
                onClick={handleRefresh}
                disabled={stats.loading}
              >
                {stats.loading ? 'Refreshing...' : 'Refresh Now'}
              </button>
              <button 
                className={styles.viewAllButton}
                onClick={() => {
                  setShowActiveSessionsModal(false);
                  router.push('/avcomputers');
                }}
              >
                View All Computers
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageWrapper>
  );
} 