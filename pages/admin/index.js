import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaUsers, FaCalendarAlt, FaDesktop, FaClock, FaChartBar, FaBell, FaTimes, FaTh, FaList, FaLaptop, FaCheck } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AdminDashboard.module.css';
import sharedStyles from '../../styles/Shared.module.css';
import { fetchActiveUserSessions, fetchTopUsers } from '../../utils/api';

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

// Add a debugMode flag for controlling console logs
const debugMode = false;

// Update the debugging helper
const debugLog = (message, data) => {
  if (debugMode) {
    console.log(`[DEBUG] ${message}:`, data);
  }
};

export default function AdminDashboard() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    profilesCount: 0,
    gizmoUsersCount: 0,
    activeUsers: 0,
    totalEvents: 0,
    activeSessions: [],
    loading: true
  });

  // Add a ref for the AbortController
  const abortControllerRef = React.useRef(null);

  // Replace handleRefresh function with fetchAdminStats
  const fetchAdminStats = async () => {
    if (!user) return;
    
    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;
      
      // Get active sessions with time details
      const sessionsWithDetails = await fetchActiveUserSessions(signal);
      
      // Get events count
      const { count: eventsCount, error: eventsError } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .abortSignal(signal);
        
      if (eventsError && eventsError.code !== 'AbortError') {
        console.error('Error fetching events count:', eventsError);
      }
      
      // Get users count - since Gizmo accounts are website users,
      // just count from the main users table
      const { count: usersCount, error: usersError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .abortSignal(signal);
        
      if (usersError && usersError.code !== 'AbortError') {
        console.error('Error fetching users count:', usersError);
      }
      
      // Get active users (users with activity in the last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { count: activeUsersCount, error: activeUsersError } = await supabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gt('created_at', oneDayAgo.toISOString())
        .abortSignal(signal);
        
      if (activeUsersError && activeUsersError.code !== 'AbortError') {
        console.error('Error fetching active users count:', activeUsersError);
      }
      
      // Update stats without changing loading state for refresh
      setStats(prev => ({
        totalUsers: usersCount || prev.totalUsers,
        activeUsers: activeUsersCount || prev.activeUsers,
        totalEvents: eventsCount || prev.totalEvents,
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

  // Set up auto-refresh with useInterval (reduce to 5 seconds = 5000ms to prevent excessive API calls)
  useInterval(() => {
    // Only fetch if component is mounted and the tab is active
    if (document.visibilityState === 'visible') {
      fetchAdminStats();
    }
  }, 5000);

  // Update the cleanup effect to use the ref
  useEffect(() => {
    return () => {
      // Abort any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Add initial useEffect to set loading to false after first data fetch
  useEffect(() => {
    // Only set loading to true for the initial fetch
    setStats(prev => ({ ...prev, loading: true }));
    
    // Fetch initial data
    fetchAdminStats();
    
    // Set a timeout to ensure loading state is cleared even if fetch fails
    const timer = setTimeout(() => {
      setStats(prev => ({ ...prev, loading: false }));
    }, 2000);
    
    return () => clearTimeout(timer);
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
                  {stats.totalUsers}
                </div>
                <div className={styles.statSubtext}>
                  Registered accounts
                </div>
              </div>
            </div>
            
            <div 
              className={`${styles.statCard} ${styles.clickableStatCard}`} 
              onClick={() => router.push('/admin/events')}
            >
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(234, 67, 53, 0.2)' }}>
                <FaCalendarAlt style={{ color: '#EA4335' }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statTitle}>Events</div>
                <div className={styles.statValue}>
                  {stats.totalEvents}
                </div>
                <div className={styles.statSubtext}>Total events</div>
              </div>
            </div>
            
            <div
              className={`${styles.statCard} ${styles.clickableStatCard}`}
              onClick={() => router.push('/admin/sessions')}
            >
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(52, 168, 83, 0.2)' }}>
                <FaDesktop style={{ color: '#34A853' }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statTitle}>Active Sessions</div>
                <div className={styles.statValue}>
                  {formatSessionCount(stats.activeSessions.length)}
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
                  {stats.activeUsers}
                </div>
                <div className={styles.statSubtext}>In the last 24 hours</div>
              </div>
            </div>
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
    </AdminPageWrapper>
  );
} 