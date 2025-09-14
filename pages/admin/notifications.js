import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  MdAdd, 
  MdEdit, 
  MdDelete, 
  MdSchedule,
  MdClose,
  MdVisibility
} from 'react-icons/md';
import styles from '../../styles/AdminNotifications.module.css';
import AdminPageWrapper from '../../components/AdminPageWrapper';

export default function AdminNotifications() {
  const { supabase } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' or 'read-stats'
  const [readStats, setReadStats] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    expires_at: ''
  });

  // Fetch read statistics
  const fetchReadStats = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/admin/notifications/read-stats', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        setReadStats(result.notifications || []);
      } else {
        console.error('Failed to fetch read stats:', result);
        setReadStats([]); // Set empty array on error
        toast.error(result.message || 'Failed to fetch read statistics');
      }
    } catch (error) {
      console.error('Error fetching read stats:', error);
      setReadStats([]); // Set empty array on error
      toast.error('Error fetching read statistics');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/admin/notifications', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        setNotifications(result.notifications);
      } else {
        console.error('Failed to fetch notifications:', result);
        if (result.error === 'database_error') {
          toast.error('Database error: Please ensure the notifications table is created. Check the SQL migration.');
        } else {
          toast.error(result.message || 'Failed to fetch notifications');
        }
      }
    } catch (error) {
        console.error('Error fetching notifications:', error);
      toast.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications();
    fetchReadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      expires_at: ''
    });
    setEditingNotification(null);
    setShowCreateForm(false);
  };

  // Create notification
  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          message: formData.message.trim(),
          expires_at: formData.expires_at || null
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Notification created successfully');
        resetForm();
        fetchNotifications();
        fetchReadStats(); // Refresh statistics tab
      } else {
        toast.error(result.message || 'Failed to create notification');
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Failed to create notification');
    }
  };

  // Edit notification
  const handleEdit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: editingNotification.id,
          title: formData.title.trim(),
          message: formData.message.trim(),
          expires_at: formData.expires_at || null
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Notification updated successfully');
        resetForm();
        fetchNotifications();
        fetchReadStats(); // Refresh statistics tab
      } else {
        toast.error(result.message || 'Failed to update notification');
      }
    } catch (error) {
      console.error('Error updating notification:', error);
      toast.error('Failed to update notification');
    }
  };


  // Delete notification
  const handleDelete = async (notification) => {
    if (!confirm('Are you sure you want to delete this notification?')) {
        return;
      }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`/api/admin/notifications?id=${notification.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Notification deleted successfully');
        fetchNotifications();
        fetchReadStats(); // Refresh statistics tab
      } else {
        toast.error(result.message || 'Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // Start editing
  const startEdit = (notification) => {
    setFormData({
      title: notification.title,
      message: notification.message,
      expires_at: notification.expires_at ? notification.expires_at.split('T')[0] : ''
    });
    setEditingNotification(notification);
    setShowCreateForm(true);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
  return (
      <AdminPageWrapper>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading notifications...</p>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Notification Management</h1>
          <button 
            className={styles.createButton}
            onClick={() => setShowCreateForm(true)}
          >
            <MdAdd />
            Create Notification
          </button>
          </div>
          
        {/* Tab Navigation */}
        <div className={styles.tabNavigation}>
            <button 
            className={`${styles.tabButton} ${activeTab === 'notifications' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('notifications')}
            >
            <MdSchedule />
            Notifications
            </button>
            <button 
            className={`${styles.tabButton} ${activeTab === 'read-stats' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('read-stats')}
            >
            <MdVisibility />
            Read Statistics
            </button>
        </div>
          
        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className={styles.formOverlay}>
            <div className={styles.formContainer}>
              <div className={styles.formHeader}>
                <h2>{editingNotification ? 'Edit Notification' : 'Create Notification'}</h2>
            <button 
                  className={styles.closeButton}
                  onClick={resetForm}
            >
                  <MdClose />
            </button>
          </div>

              <form className={styles.notificationForm} onSubmit={editingNotification ? handleEdit : handleCreate}>
                <div className={styles.formGroup}>
                  <label htmlFor="title">Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter notification title"
                    maxLength={255}
                    required
                  />
        </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Enter notification message"
                    rows={4}
                    required
                  />
          </div>

                <div className={styles.formGroup}>
                  <label htmlFor="expires_at">Expiration Date (Optional)</label>
                  <input
                    type="date"
                    id="expires_at"
                    name="expires_at"
                    value={formData.expires_at}
                    onChange={handleInputChange}
                  />
          </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={resetForm} className={styles.cancelButton}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitButton}>
                    {editingNotification ? 'Update' : 'Create'} Notification
                  </button>
          </div>
              </form>
          </div>
        </div>
        )}

        {/* Tab Content */}
        {activeTab === 'notifications' && (
        <div className={styles.notificationsList}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No notifications created yet.</p>
                <button 
                  className={styles.createFirstButton}
                  onClick={() => setShowCreateForm(true)}
                >
                  Create your first notification
                </button>
            </div>
          ) : (
              notifications.map((notification) => (
              <div key={notification.id} className={styles.notificationCard}>
                  <div className={styles.notificationHeader}>
                  <h3 className={styles.notificationTitle}>{notification.title}</h3>
                  </div>

                  <div className={styles.notificationContent}>
                  <p>{notification.message}</p>
                        </div>

                <div className={styles.notificationMeta}>
                  <div className={styles.metaInfo}>
                    <span>Created: {formatDate(notification.created_at)}</span>
                    {notification.expires_at && (
                      <span>
                        <MdSchedule /> Expires: {formatDate(notification.expires_at)}
                      </span>
                      )}
                    </div>

                  <div className={styles.notificationActions}>
                    <button
                      onClick={() => startEdit(notification)}
                      className={styles.editButton}
                      title="Edit notification"
                    >
                      <MdEdit />
                    </button>

                    <button
                      onClick={() => handleDelete(notification)}
                      className={styles.deleteButton}
                      title="Delete notification"
                    >
                      <MdDelete />
                    </button>
                  </div>
                </div>
                        </div>
            ))
                      )}
                        </div>
                      )}
                      
        {/* Read Statistics Tab */}
        {activeTab === 'read-stats' && (
          <div className={styles.readStatsList}>
            {!readStats || readStats.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No read statistics available yet.</p>
              </div>
            ) : (
              readStats.map((stat) => (
                <div key={stat.id} className={styles.readStatsCard}>
                  <div className={styles.readStatsHeader}>
                    <h3 className={styles.readStatsTitle}>{stat.title}</h3>
                    <div className={styles.readStatsMeta}>
                      <span>Created: {formatDate(stat.created_at)}</span>
                        </div>
                    </div>

                  <div className={styles.readStatsContent}>
                    <div className={styles.readStatsGrid}>
                      <div className={styles.readStatsItem}>
                        <div className={styles.readStatsLabel}>Total Users</div>
                        <div className={styles.readStatsValue}>{stat.stats.total_users}</div>
                      </div>
                      <div className={styles.readStatsItem}>
                        <div className={styles.readStatsLabel}>Read Users</div>
                        <div className={styles.readStatsValue}>{stat.stats.read_users}</div>
                      </div>
                      <div className={styles.readStatsItem}>
                        <div className={styles.readStatsLabel}>Read Percentage</div>
                        <div className={styles.readStatsValue}>{stat.stats.read_percentage}%</div>
                      </div>
                      </div>
                    
                    {stat.stats.read_percentage > 0 && (
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill} 
                          style={{ width: `${stat.stats.read_percentage}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
}
