import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import Head from 'next/head';
import { toast } from 'react-hot-toast';
import { 
  FaBell, 
  FaExclamationTriangle, 
  FaShieldAlt, 
  FaEye, 
  FaFilter,
  FaCalendarAlt,
  FaUser,
  FaGlobe,
  FaSearch,
  FaTrash,
  FaDownload
} from 'react-icons/fa';
import styles from '../../styles/AdminNotifications.module.css';
import { withServerSideAdmin } from '../../utils/supabase/server-admin';

export default function AdminNotifications() {
  const { user, supabase } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    severity: 'all',
    type: 'all',
    dateRange: '7d'
  });

  // Fetch security events
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      if (filter.severity !== 'all') {
        query = query.eq('severity', filter.severity);
      }
      
      if (filter.type !== 'all') {
        query = query.eq('event_type', filter.type);
      }

      // Date range filter
      if (filter.dateRange !== 'all') {
        const days = parseInt(filter.dateRange.replace('d', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        toast.error('Failed to load security notifications');
        return;
      }

      setNotifications(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter, supabase]);

  // Get severity icon and color
  const getSeverityInfo = (severity) => {
    switch (severity) {
      case 'critical':
        return { icon: FaExclamationTriangle, color: '#ff4444', bgColor: '#ffe6e6' };
      case 'high':
        return { icon: FaShieldAlt, color: '#ff8800', bgColor: '#fff2e6' };
      case 'medium':
        return { icon: FaBell, color: '#ffaa00', bgColor: '#fff8e6' };
      case 'low':
        return { icon: FaEye, color: '#4CAF50', bgColor: '#e8f5e8' };
      default:
        return { icon: FaBell, color: '#666', bgColor: '#f5f5f5' };
    }
  };

  // Format event type for display
  const formatEventType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Clear old notifications
  const clearOldNotifications = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await supabase
        .from('security_events')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (error) {
        toast.error('Failed to clear old notifications');
        return;
      }

      toast.success('Cleared notifications older than 30 days');
      fetchNotifications();
    } catch (error) {
      toast.error('Failed to clear notifications');
    }
  };

  // Export notifications as JSON
  const exportNotifications = () => {
    const dataStr = JSON.stringify(notifications, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `security-events-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <AdminPageWrapper title="Security Notifications">
      <Head>
        <title>Security Notifications - Admin Dashboard</title>
      </Head>

      <div className={styles.notificationsContainer}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <FaBell className={styles.titleIcon} />
            <h1>Security Notifications</h1>
            <span className={styles.count}>({notifications.length})</span>
          </div>
          
          <div className={styles.actions}>
            <button 
              onClick={exportNotifications}
              className={styles.exportBtn}
              disabled={notifications.length === 0}
            >
              <FaDownload /> Export
            </button>
            <button 
              onClick={clearOldNotifications}
              className={styles.clearBtn}
            >
              <FaTrash /> Clear Old
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>
              <FaFilter /> Severity:
              <select 
                value={filter.severity} 
                onChange={(e) => setFilter(prev => ({ ...prev, severity: e.target.value }))}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>

          <div className={styles.filterGroup}>
            <label>
              <FaSearch /> Event Type:
              <select 
                value={filter.type} 
                onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
              >
                <option value="all">All Types</option>
                <option value="unauthorized_admin_access">Unauthorized Admin Access</option>
                <option value="unauthorized_staff_access">Unauthorized Staff Access</option>
                <option value="api_abuse">API Abuse</option>
              </select>
            </label>
          </div>

          <div className={styles.filterGroup}>
            <label>
              <FaCalendarAlt /> Time Range:
              <select 
                value={filter.dateRange} 
                onChange={(e) => setFilter(prev => ({ ...prev, dateRange: e.target.value }))}
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </label>
          </div>
        </div>

        {/* Notifications List */}
        <div className={styles.notificationsList}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading security notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>
              <FaShieldAlt className={styles.emptyIcon} />
              <h3>No Security Events</h3>
              <p>No security notifications found for the selected filters.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const severityInfo = getSeverityInfo(notification.severity);
              const SeverityIcon = severityInfo.icon;

              return (
                <div 
                  key={notification.id} 
                  className={styles.notificationCard}
                  style={{ borderLeftColor: severityInfo.color }}
                >
                  <div className={styles.notificationHeader}>
                    <div className={styles.severityBadge} style={{ backgroundColor: severityInfo.bgColor, color: severityInfo.color }}>
                      <SeverityIcon />
                      <span>{notification.severity.toUpperCase()}</span>
                    </div>
                    <div className={styles.timestamp}>
                      <FaCalendarAlt />
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className={styles.notificationContent}>
                    <h3 className={styles.eventType}>
                      {formatEventType(notification.event_type)}
                    </h3>
                    
                    <div className={styles.details}>
                      {notification.username && (
                        <div className={styles.detail}>
                          <FaUser />
                          <span><strong>User:</strong> {notification.username}</span>
                        </div>
                      )}
                      
                      {notification.ip_address && (
                        <div className={styles.detail}>
                          <FaGlobe />
                          <span><strong>IP:</strong> {notification.ip_address}</span>
                        </div>
                      )}
                      
                      {notification.attempted_path && (
                        <div className={styles.detail}>
                          <FaSearch />
                          <span><strong>Path:</strong> {notification.attempted_path}</span>
                        </div>
                      )}
                    </div>

                    {notification.details && (
                      <div className={styles.additionalDetails}>
                        <p>{notification.details}</p>
                      </div>
                    )}

                    {notification.user_agent && (
                      <div className={styles.userAgent}>
                        <small><strong>User Agent:</strong> {notification.user_agent}</small>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary Stats */}
        {notifications.length > 0 && (
          <div className={styles.summary}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Critical Events:</span>
              <span className={styles.statValue}>
                {notifications.filter(n => n.severity === 'critical').length}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>High Priority:</span>
              <span className={styles.statValue}>
                {notifications.filter(n => n.severity === 'high').length}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Unique IPs:</span>
              <span className={styles.statValue}>
                {new Set(notifications.map(n => n.ip_address).filter(Boolean)).size}
              </span>
            </div>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
}

// 🛡️ SERVER-SIDE PROTECTION: Require admin privileges
export const getServerSideProps = withServerSideAdmin(true);
