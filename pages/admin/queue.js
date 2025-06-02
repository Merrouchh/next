import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaUsers, FaPlus, FaTimes, FaEdit, FaArrowUp, FaArrowDown, FaDesktop, FaPhone, FaStickyNote, FaClock, FaSync } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AdminQueue.module.css';
import { toast } from 'react-hot-toast';

export default function QueueManagement() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    user_name: '',
    phone_number: '',
    computer_type: 'any',
    notes: ''
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch queue data
  const fetchQueue = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch('/api/computer-queue', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch queue');
      }

      const data = await response.json();
      setQueue(data.queue || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching queue:', error);
      if (!isLoading) { // Only show toast if not initial loading
        toast.error('Failed to load queue');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    
    // Set up real-time updates every 5 seconds
    const intervalId = setInterval(() => {
      fetchQueue(true); // Show refreshing indicator for automatic updates
    }, 5000);

    // Cleanup interval on component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Add new entry to queue
  const handleAddToQueue = async (e) => {
    e.preventDefault();
    
    if (!newEntry.user_name.trim()) {
      toast.error('User name is required');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/computer-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newEntry)
      });

      if (!response.ok) {
        throw new Error('Failed to add to queue');
      }

      toast.success('Added to queue successfully');
      setNewEntry({
        user_name: '',
        phone_number: '',
        computer_type: 'any',
        notes: ''
      });
      setShowAddModal(false);
      fetchQueue();
    } catch (error) {
      console.error('Error adding to queue:', error);
      toast.error('Failed to add to queue');
    }
  };

  // Remove from queue
  const handleRemoveFromQueue = async (id) => {
    if (!confirm('Are you sure you want to remove this person from the queue?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/computer-queue?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove from queue');
      }

      toast.success('Removed from queue successfully');
      fetchQueue();
    } catch (error) {
      console.error('Error removing from queue:', error);
      toast.error('Failed to remove from queue');
    }
  };

  // Move entry up or down in queue
  const moveInQueue = async (index, direction) => {
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;
    
    // Swap positions
    [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];
    
    // Update positions
    const updatedQueue = newQueue.map((entry, idx) => ({
      ...entry,
      position: idx + 1
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/computer-queue', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ queue: updatedQueue })
      });

      if (!response.ok) {
        throw new Error('Failed to update queue');
      }

      setQueue(updatedQueue);
      toast.success('Queue updated successfully');
    } catch (error) {
      console.error('Error updating queue:', error);
      toast.error('Failed to update queue');
    }
  };

  const formatComputerType = (type) => {
    switch (type) {
      case 'normal': return 'Normal PC';
      case 'vip': return 'VIP PC';
      case 'any': return 'Any PC';
      default: return type;
    }
  };

  const getComputerTypeColor = (type) => {
    switch (type) {
      case 'normal': return '#4285F4';
      case 'vip': return '#9C27B0';
      case 'any': return '#34A853';
      default: return '#666';
    }
  };

  if (isLoading) {
    return (
      <AdminPageWrapper title="Queue Management">
        <div className={styles.loading}>Loading queue...</div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper title="Queue Management">
      <Head>
        <title>Queue Management | Merrouch Gaming Center</title>
        <meta name="description" content="Manage the computer waiting queue" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={styles.queueContainer}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>
              <FaUsers className={styles.titleIcon} />
              Computer Queue Management
            </h1>
            <p className={styles.subtitle}>
              Manage customers waiting for computers. When there are people in the queue, remote logins are disabled.
            </p>
            
            <div className={styles.liveIndicator}>
              <div className={`${styles.liveDot} ${isRefreshing ? styles.refreshing : ''}`}></div>
              <span className={styles.liveText}>
                Live Updates
                {lastUpdated && (
                  <small>Last updated: {lastUpdated.toLocaleTimeString()}</small>
                )}
              </span>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            <button 
              className={styles.refreshButton}
              onClick={() => fetchQueue(true)}
              disabled={isRefreshing}
              title="Refresh queue manually"
            >
              <FaSync className={isRefreshing ? styles.spinning : ''} />
            </button>
            
            <button 
              className={styles.addButton}
              onClick={() => setShowAddModal(true)}
            >
              <FaPlus /> Add to Queue
            </button>
          </div>
        </div>

        <div className={styles.queueStats}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <FaUsers />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statNumber}>{queue.length}</div>
              <div className={styles.statLabel}>People Waiting</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(66, 133, 244, 0.2)' }}>
              <FaDesktop style={{ color: '#4285F4' }} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statNumber}>
                {queue.filter(q => q.computer_type === 'normal').length}
              </div>
              <div className={styles.statLabel}>Normal PC Queue</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.2)' }}>
              <FaDesktop style={{ color: '#9C27B0' }} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statNumber}>
                {queue.filter(q => q.computer_type === 'vip').length}
              </div>
              <div className={styles.statLabel}>VIP PC Queue</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(52, 168, 83, 0.2)' }}>
              <FaDesktop style={{ color: '#34A853' }} />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statNumber}>
                {queue.filter(q => q.computer_type === 'any').length}
              </div>
              <div className={styles.statLabel}>Any PC Queue</div>
            </div>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className={styles.emptyQueue}>
            <FaUsers className={styles.emptyIcon} />
            <h2>No one in queue</h2>
            <p>Remote logins are currently enabled. Add people to the queue to disable remote logins.</p>
          </div>
        ) : (
          <div className={styles.queueList}>
            <h2 className={styles.sectionTitle}>Current Queue ({queue.length} people)</h2>
            
            {queue.map((entry, index) => (
              <div key={entry.id} className={styles.queueEntry}>
                <div className={styles.positionBadge}>
                  #{entry.position}
                </div>
                
                <div className={styles.entryContent}>
                  <div className={styles.entryHeader}>
                    <h3 className={styles.userName}>{entry.user_name}</h3>
                    <div 
                      className={styles.computerType}
                      style={{ 
                        backgroundColor: `${getComputerTypeColor(entry.computer_type)}20`,
                        color: getComputerTypeColor(entry.computer_type),
                        border: `1px solid ${getComputerTypeColor(entry.computer_type)}40`
                      }}
                    >
                      <FaDesktop />
                      {formatComputerType(entry.computer_type)}
                    </div>
                  </div>
                  
                  <div className={styles.entryDetails}>
                    {entry.phone_number && (
                      <div className={styles.detail}>
                        <FaPhone className={styles.detailIcon} />
                        <span>{entry.phone_number}</span>
                      </div>
                    )}
                    
                    {entry.notes && (
                      <div className={styles.detail}>
                        <FaStickyNote className={styles.detailIcon} />
                        <span>{entry.notes}</span>
                      </div>
                    )}
                    
                    <div className={styles.detail}>
                      <FaClock className={styles.detailIcon} />
                      <span>Added {new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.entryActions}>
                  <button
                    className={styles.moveButton}
                    onClick={() => moveInQueue(index, 'up')}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <FaArrowUp />
                  </button>
                  
                  <button
                    className={styles.moveButton}
                    onClick={() => moveInQueue(index, 'down')}
                    disabled={index === queue.length - 1}
                    title="Move down"
                  >
                    <FaArrowDown />
                  </button>
                  
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveFromQueue(entry.id)}
                    title="Remove from queue"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add to Queue Modal */}
        {showAddModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Add Person to Queue</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowAddModal(false)}
                >
                  <FaTimes />
                </button>
              </div>
              
              <form onSubmit={handleAddToQueue} className={styles.modalForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="user_name">Customer Name *</label>
                  <input
                    type="text"
                    id="user_name"
                    value={newEntry.user_name}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, user_name: e.target.value }))}
                    required
                    placeholder="Enter customer name"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="phone_number">Phone Number</label>
                  <input
                    type="tel"
                    id="phone_number"
                    value={newEntry.phone_number}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, phone_number: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="computer_type">Preferred Computer Type</label>
                  <select
                    id="computer_type"
                    value={newEntry.computer_type}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, computer_type: e.target.value }))}
                  >
                    <option value="any">Any PC</option>
                    <option value="normal">Normal PC Only</option>
                    <option value="vip">VIP PC Only</option>
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                    rows="3"
                  />
                </div>
                
                <div className={styles.modalActions}>
                  <button type="button" onClick={() => setShowAddModal(false)} className={styles.cancelButton}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.addButton}>
                    Add to Queue
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
} 