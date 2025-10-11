import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { FaBell, FaEllipsisV } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/NotificationBubble.module.css';

const NotificationBubble = () => {
  const { supabase } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const bubbleRef = useRef(null);
  const menuRef = useRef(null);
  const isMarkingRef = useRef(false);
  const refreshTimeoutRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const handleClose = useCallback(() => {
    if (!isExpanded) return;
    // Close immediately for snappy UX
    setIsExpanded(false);
    setIsMenuOpen(false);
  }, [isExpanded]);

  const handleMarkAllAsRead = useCallback(async () => {
    // Prevent concurrent mark-read jobs
    if (isMarkingRef.current) return;
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    isMarkingRef.current = true;
    try {
      // Optimistic UI: locally flip to read to update badge instantly
      setNotifications(prev => prev.map(n => (n.isRead ? n : { ...n, isRead: true })));
      for (const n of unread) {
        await markNotificationAsRead(n.id);
      }
      // Debounced refresh
      scheduleRefresh();
    } finally {
      isMarkingRef.current = false;
    }
  }, [notifications, markNotificationAsRead, scheduleRefresh]);

  const handleNotificationClick = useCallback(async (notification) => {
    try {
      // Build a URL that forces navigation even if you are already on the same page
      const clipId = notification?.data?.clip_id;
      const eventId = notification?.data?.event_id;
      const uniqueParam = `notif=${encodeURIComponent(notification.id)}&ts=${Date.now()}`;

      if ((notification?.type === 'like' || notification?.type === 'comment' || notification?.type === 'upload') && clipId) {
        const baseTarget = `/clip/${clipId}`;
        const target = `${baseTarget}?${uniqueParam}`;
        // If already on this clip page, replace to force a rerender with a fresh ts
        if (router.asPath.split('?')[0] === baseTarget) {
          await router.replace(target, undefined, { scroll: false });
        } else {
          router.push(target);
        }
      } else if (notification?.type === 'event' && eventId) {
        const baseTarget = `/events/${eventId}`;
        const target = `${baseTarget}?${uniqueParam}`;
        if (router.asPath.split('?')[0] === baseTarget) {
          await router.replace(target, undefined, { scroll: false });
        } else {
          router.push(target);
        }
      }
      // Close the bubble immediately so navigation isn't blocked visually
      setIsExpanded(false);
      // Optimistically mark this item as read
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
      await markNotificationAsRead(notification.id);
    } catch {
      // ignore navigation errors
    }
  }, [router, markNotificationAsRead]);

  const handleMarkOneAsRead = useCallback(async (notificationId) => {
    if (isMarkingRef.current) return;
    // If already read, do nothing
    const target = notifications.find(n => n.id === notificationId);
    if (!target || target.isRead) return;

    isMarkingRef.current = true;
    try {
      // Optimistic UI
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
      await markNotificationAsRead(notificationId);
      scheduleRefresh();
    } finally {
      isMarkingRef.current = false;
    }
  }, [notifications, markNotificationAsRead, scheduleRefresh]);

  const handleToggle = () => {
    if (isExpanded) {
      handleClose();
    } else {
      setIsExpanded(true);
    }
  };

  const handleItemKeyDown = useCallback((e, notification) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNotificationClick(notification);
    }
  }, [handleNotificationClick]);

  const isActionableNotification = useCallback((n) => {
    const clipId = n?.data?.clip_id;
    const eventId = n?.data?.event_id;
    if ((n?.type === 'like' || n?.type === 'comment' || n?.type === 'upload') && clipId) return true;
    if (n?.type === 'event' && eventId) return true;
    return false;
  }, []);

  useEffect(() => {
    fetchNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    // Close bubble when clicking outside
    const handleClickOutside = (event) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClose]);

  // Close header menu when clicking outside of it
  useEffect(() => {
    const handleMenuOutside = (event) => {
      if (!isMenuOpen) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMenuOutside);
    return () => document.removeEventListener('mousedown', handleMenuOutside);
  }, [isMenuOpen]);

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

  // Dynamic offset to avoid overlapping the floating upload button
  const [bottomOffset, setBottomOffset] = useState(24);
  useEffect(() => {
    const computeOffset = () => {
      // Stack over any known floating controls in bottom-right
      const ids = ['floating-upload-button', 'floating-refresh-button'];
      const elements = ids
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .sort((a, b) => a.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom);

      let offset = 24; // default bottom spacing
      elements.forEach(() => {
        // stack each item height + gap
        offset += 60 + 16; // assume 60x60 fab like upload/refresh + 16px gap
      });
      setBottomOffset(offset);
    };
    computeOffset();
    window.addEventListener('resize', computeOffset);
    const interval = setInterval(computeOffset, 500);
    return () => {
      window.removeEventListener('resize', computeOffset);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={styles.bubbleContainer} ref={bubbleRef} style={{ bottom: `${bottomOffset}px` }}>
      
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
            <div className={styles.menuWrapper} ref={menuRef}>
              <button
                type="button"
                className={styles.menuButton}
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
                aria-label="Open notifications menu"
                onClick={() => setIsMenuOpen(v => !v)}
              >
                <FaEllipsisV />
              </button>
              {isMenuOpen && (
                <div className={styles.menuDropdown} role="menu">
                  <button
                    type="button"
                    className={`${styles.menuItem} ${unreadCount === 0 ? styles.menuItemDisabled : ''}`}
                    role="menuitem"
                    onClick={() => { if (unreadCount > 0) { handleMarkAllAsRead(); setIsMenuOpen(false); } }}
                    disabled={unreadCount === 0}
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </div>
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
              </div>
            ) : (
              allNotifications.map((notification) => {
                const actionable = isActionableNotification(notification);
                return (
                  <div 
                    key={notification.id} 
                    className={`${styles.notificationItem} ${styles[notification.type || 'info']} ${notification.isRead ? styles.read : styles.unread} ${actionable ? styles.actionable : ''}`}
                    role={actionable ? "button" : undefined}
                    tabIndex={actionable ? 0 : -1}
                    onClick={actionable ? () => handleNotificationClick(notification) : undefined}
                    onKeyDown={actionable ? (e) => handleItemKeyDown(e, notification) : undefined}
                    aria-disabled={!actionable}
                  >
                    <div className={styles.notificationContent}>
                      <div className={styles.notificationHeader}>
                        <h4 className={styles.notificationTitle}>{notification.title}</h4>
                      </div>
                      <p className={styles.notificationMessage}>{notification.message}</p>
                      <div className={styles.notificationMeta}>
                        <span className={styles.notificationDate}>
                          {new Date(notification.created_at).toLocaleDateString()} at{' '}
                          {new Date(notification.created_at).toLocaleTimeString()}
                        </span>
                        {!notification.isRead && (
                          <button
                            className={styles.markOneButton}
                            onClick={(e) => { e.stopPropagation(); handleMarkOneAsRead(notification.id); }}
                            aria-label="Mark notification as read"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBubble;
