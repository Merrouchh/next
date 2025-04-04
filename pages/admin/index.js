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
        console.log('Active sessions:', activeSessions);
        
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
          activeSessions: activeSessions || [],
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

  // Add a refresh function to the component
  const handleRefresh = async () => {
    setStats(prev => ({ ...prev, loading: true }));
    try {
      // Get active sessions
      const activeSessions = await fetchActiveUserSessions();
      
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
        activeSessions: activeSessions || [],
        loading: false
      });
    } catch (error) {
      console.error('Error refreshing admin stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
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
            <div className={styles.modalBody}>
              {stats.activeSessions.length === 0 ? (
                <div className={styles.noSessions}>
                  <p>No active sessions at this time</p>
                </div>
              ) : (
                <div className={styles.sessionsList}>
                  {stats.activeSessions.map((session, index) => (
                    <div key={index} className={styles.sessionItem}>
                      <div className={styles.sessionComputer}>
                        <FaDesktop />
                        <span>{session.computer_name || `Computer ${session.computer_id}`}</span>
                      </div>
                      <div className={styles.sessionInfo}>
                        <div className={styles.sessionUser}>
                          <strong>User:</strong> {session.user_name || "Unknown"}
                        </div>
                        <div className={styles.sessionTime}>
                          <strong>Time Left:</strong> {session.time_left || "Unknown"}
                        </div>
                        {session.start_time && (
                          <div className={styles.sessionStart}>
                            <strong>Started:</strong> {new Date(session.start_time).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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