import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { FaBell } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/NotificationBubble.module.css';

const NotificationBubble = () => {
  const { supabase } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const bubbleRef = useRef(null);
  const isMarkingRef = useRef(false);
  const refreshTimeoutRef = useRef(null);
  const [userId, setUserId] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get the access token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      const response = await fetch('/api/notifications', {
        headers
      });
      const result = await response.json();
      
      if (result.success) {
        setNotifications(result.notifications || []);
      } else {
        console.error('Failed to fetch notifications:', result.message);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Resolve current user id once for realtime filtering
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (mounted) setUserId(userData?.user?.id || null);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [supabase]);

  // Debounced refresh helper to avoid fetch storms
  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      fetchNotifications();
    }, 350);
  }, [fetchNotifications]);

  const markNotificationAsRead = useCallback(async (notificationId) => {
    // Mark notification as read in the database
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;


      if (accessToken) {
        const response = await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notification_id: notificationId })
        });

        await response.json();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [supabase]);

  const handleCloseWithMarkAsRead = useCallback(async () => {
    if (!isExpanded) return;
    // Close immediately for snappy UX
    setIsExpanded(false);
    
    // Prevent concurrent mark-read jobs
    if (isMarkingRef.current) return;
    isMarkingRef.current = true;

    try {
      const unread = notifications.filter(n => !n.isRead);
      if (unread.length === 0) return;

      // Optimistic UI: locally flip to read to update badge instantly
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

      for (const n of unread) {
        await markNotificationAsRead(n.id);
      }
      // Soft refresh in background (no spinner)
      fetchNotifications();
    } finally {
      isMarkingRef.current = false;
    }
  }, [isExpanded, notifications, markNotificationAsRead, fetchNotifications]);

  const handleNotificationClick = useCallback(async (notification) => {
    try {
      // Navigate based on type
      const clipId = notification?.data?.clip_id;
      const eventId = notification?.data?.event_id;
      if ((notification?.type === 'like' || notification?.type === 'comment' || notification?.type === 'upload') && clipId) {
        router.push(`/clip/${clipId}`);
      } else if (notification?.type === 'event' && eventId) {
        router.push(`/events/${eventId}`);
      }
      // Optionally mark this single item as read optimistically
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
      await markNotificationAsRead(notification.id);
    } catch {
      // ignore navigation errors
    }
  }, [router, markNotificationAsRead]);

  const handleToggle = async () => {
    if (isExpanded) {
      await handleCloseWithMarkAsRead();
    } else {
      setIsExpanded(true);
    }
  };

  useEffect(() => {
    fetchNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    // Close bubble when clicking outside
    const handleClickOutside = (event) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target)) {
        handleCloseWithMarkAsRead();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleCloseWithMarkAsRead]);

  // Supabase Realtime: live update on notifications and read-status changes
  useEffect(() => {
    // Subscribe to notifications changes
    const notifChannel = supabase
      .channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, scheduleRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, scheduleRefresh)
      .subscribe();

    // Subscribe to current user's read events
    let readsChannel = null;
    if (userId) {
      readsChannel = supabase
        .channel(`realtime_notification_reads_${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification_reads', filter: `user_id=eq.${userId}` }, scheduleRefresh)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notification_reads', filter: `user_id=eq.${userId}` }, scheduleRefresh)
        .subscribe();
    }

    return () => {
      try { supabase.removeChannel(notifChannel); } catch {}
      if (readsChannel) { try { supabase.removeChannel(readsChannel); } catch {} }
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [supabase, userId, scheduleRefresh]);

  // Separate unread and read notifications (don't filter by dismissedNotifications)
  const unreadNotifications = notifications.filter(
    notification => !notification.isRead
  );
  
  const readNotifications = notifications.filter(
    notification => notification.isRead
  );
  
  // All visible notifications (for display)
  const allNotifications = [...unreadNotifications, ...readNotifications];
  
  // Count only unread notifications for the badge
  const unreadCount = unreadNotifications.length;
  

  // Always show the bubble (don't hide when no notifications)

  return (
    <div className={styles.bubbleContainer} ref={bubbleRef}>
      
      {/* Bubble Button */}
      <button 
        className={`${styles.bubbleButton} ${isExpanded ? styles.expanded : ''}`}
        onClick={handleToggle}
        aria-label={`${unreadCount} unread notifications`}
      >
        <FaBell className={styles.bellIcon} />
        {unreadCount > 0 && (
          <span className={styles.notificationCount}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isExpanded && (
        <div className={styles.notificationsPanel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <FaBell className={styles.headerIcon} />
              Notifications
            </h3>
          </div>

          <div className={styles.notificationsList}>
            {isLoading && notifications.length === 0 ? (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading notifications...</p>
              </div>
            ) : allNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <FaBell className={styles.emptyIcon} />
                <p>No notifications</p>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                  Debug: Total: {notifications.length}, Unread: {unreadNotifications.length}, Read: {readNotifications.length}
                </div>
              </div>
            ) : (
              allNotifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`${styles.notificationItem} ${styles[notification.type || 'info']} ${notification.isRead ? styles.read : styles.unread}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      <h4 className={styles.notificationTitle}>
                        {(notification.type === 'like' || notification.type === 'comment' || notification.type === 'upload') && notification.data?.clip_id
                          ? `${notification.title}`
                          : notification.title}
                      </h4>
                    </div>
                    <p className={styles.notificationMessage}>
                      {(notification.type === 'like' || notification.type === 'comment' || notification.type === 'upload') && notification.data?.clip_title
                        ? `${notification.message}`
                        : notification.message}
                    </p>
                    <div className={styles.notificationMeta}>
                      <span className={styles.notificationDate}>
                        {new Date(notification.created_at).toLocaleDateString()} at{' '}
                        {new Date(notification.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBubble;
