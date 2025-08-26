import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import QueueAdminModal from '../../components/QueueAdminModal';
import Head from 'next/head';
import styles from '../../styles/AdminQueue.module.css';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { 
  FaPlay, FaStop, FaUserPlus, FaTrash, FaEye, FaEyeSlash,
  FaUsers, FaClock, FaDesktop, FaPhone, FaStickyNote, FaCog, FaCogs 
} from 'react-icons/fa';
import { withServerSideStaff } from '../../utils/supabase/server-admin';

export default function AdminQueue() {
  const { user, supabase, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Remove debouncing - use immediate updates instead
  const [refreshing, setRefreshing] = useState(false);
  
  // Queue system state
  const [queueActive, setQueueActive] = useState(false);
  const [onlineJoiningAllowed, setOnlineJoiningAllowed] = useState(true);
  const [queueList, setQueueList] = useState([]);
  const [automaticMode, setAutomaticMode] = useState(false);
  
  // Add new person form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonForm, setNewPersonForm] = useState({
    username: '',
    phone: '',
    notes: '',
    computerType: 'any'
  });
  const [foundUser, setFoundUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Add loading states for individual operations
  const [movingPerson, setMovingPerson] = useState(null);
  const [removingPerson, setRemovingPerson] = useState(null);
  
  // Add refs for automatic mode check to avoid recreating intervals
  const automaticModeRef = useRef(automaticMode);
  const queueListRef = useRef(queueList);
  const queueActiveRef = useRef(queueActive);
  
  // Update refs when state changes
  useEffect(() => {
    automaticModeRef.current = automaticMode;
  }, [automaticMode]);
  
  useEffect(() => {
    queueListRef.current = queueList;
  }, [queueList]);
  
  useEffect(() => {
    queueActiveRef.current = queueActive;
  }, [queueActive]);
  
  // Modal state
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null
  });

  // Helper function to show modal
  const showModal = (type, title, message, onConfirm = null) => {
    setModal({
      isOpen: true,
      type,
      title,
      message,
      onConfirm
    });
  };

  const closeModal = () => {
    setModal({
      isOpen: false,
      type: 'info',
      title: '',
      message: '',
      onConfirm: null
    });
  };

  // =============================================================================
  // 1. LOAD QUEUE DATA (runs when page loads) - IMPROVED VERSION
  // =============================================================================
  
  // Immediate refresh function - no debouncing
  const loadQueueData = async (retryCount = 0, showLoader = true) => {
    if (showLoader && !refreshing) {
      setRefreshing(true);
    }
    
    try {
      const response = await fetch('/api/queue/status');
      if (response.ok) {
        const data = await response.json();
        console.log('Queue status response:', data.status);
        
        // The status is an array, get the first element
        const status = Array.isArray(data.status) ? data.status[0] : data.status;
        
        setQueueActive(status.is_active);
        setOnlineJoiningAllowed(status.allow_online_joining);
        
        // Load automatic mode setting from database
        if (status.automatic_mode !== undefined) {
          setAutomaticMode(status.automatic_mode);
        }
        
        const newQueueList = data.queue || [];
        setQueueList(newQueueList);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading queue:', error);
      
      // Retry logic for network errors (max 2 retries)
      if (retryCount < 2 && (
        error.message.includes('fetch') || 
        error.message.includes('INSUFFICIENT_RESOURCES') ||
        error.message.includes('network')
      )) {
        console.log(`🔄 Retrying queue data load... (attempt ${retryCount + 1})`);
        setTimeout(() => {
          loadQueueData(retryCount + 1, false);
        }, (retryCount + 1) * 1000); // Exponential backoff: 1s, 2s
        return;
      }
      
      // Show user-friendly error after retries fail
      if (retryCount >= 2) {
        toast.error('Unable to load queue data. Please refresh the page.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // =============================================================================
  // 2. START/STOP QUEUE SYSTEM - IMPROVED WITH OPTIMISTIC UPDATES
  // =============================================================================
  const toggleQueueSystem = async () => {
    setSaving(true);
    
    // Optimistic update
    const previousState = queueActive;
    setQueueActive(!queueActive);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/manage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({ isActive: !previousState })
      });

      if (response.ok) {
        showModal('success', 'Queue System Updated', 
          previousState ? 'Queue system has been stopped.' : 'Queue system has been started.');
        
        // Force refresh to ensure all data is in sync
        setTimeout(() => {
          loadQueueData(0, false);
        }, 500);
      } else {
        // Revert optimistic update on error
        setQueueActive(previousState);
        showModal('error', 'Error', 'Failed to update queue system. Please try again.');
      }
    } catch (error) {
      // Revert optimistic update on error
      setQueueActive(previousState);
      showModal('error', 'Error', 'Failed to update queue system. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // 3. TOGGLE AUTOMATIC MODE - IMPROVED WITH OPTIMISTIC UPDATES
  // =============================================================================
  const toggleAutomaticMode = async () => {
    setSaving(true);
    
    // Optimistic update
    const previousState = automaticMode;
    setAutomaticMode(!automaticMode);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/manage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({ automaticMode: !previousState })
      });

      if (response.ok) {
        if (!previousState) {
          showModal('success', 'Automatic Mode Enabled', 
            'Queue will automatically turn ON when people join and OFF when empty.');
        } else {
          showModal('success', 'Automatic Mode Disabled', 
            'Manual control has been restored. You can now manually start/stop the queue.');
        }
      } else {
        // Revert optimistic update on error
        setAutomaticMode(previousState);
        showModal('error', 'Error', 'Failed to update automatic mode. Please try again.');
      }
    } catch (error) {
      // Revert optimistic update on error
      setAutomaticMode(previousState);
      showModal('error', 'Error', 'Failed to update automatic mode. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // 4. ALLOW/BLOCK ONLINE USERS FROM JOINING - IMPROVED WITH OPTIMISTIC UPDATES
  // =============================================================================
  const toggleOnlineJoining = async () => {
    setSaving(true);
    
    // Optimistic update
    const previousState = onlineJoiningAllowed;
    setOnlineJoiningAllowed(!onlineJoiningAllowed);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/manage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({ allowOnlineJoining: !previousState })
      });

      if (response.ok) {
        showModal('success', 'Online Joining Updated', 
          previousState ? 'Online joining has been blocked.' : 'Online joining has been allowed.');
      } else {
        // Revert optimistic update on error
        setOnlineJoiningAllowed(previousState);
        showModal('error', 'Error', 'Failed to update online joining settings. Please try again.');
      }
    } catch (error) {
      // Revert optimistic update on error
      setOnlineJoiningAllowed(previousState);
      showModal('error', 'Error', 'Failed to update online joining settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // 4. SEARCH FOR USERS (shows dropdown list of matching users)
  // =============================================================================
  const searchUsers = async (username) => {
    if (!username.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setFoundUser(null);
      return;
    }

    try {
      // Search for users that contain the typed text
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, phone, gizmo_id')
        .ilike('username', `%${username.trim().toLowerCase()}%`)
        .limit(8); // Show max 8 results

      if (data && !error && data.length > 0) {
        setSearchResults(data);
        setShowDropdown(true);
        setFoundUser(null); // Always clear selection until user clicks
      } else {
        setSearchResults([]);
        setShowDropdown(false);
        setFoundUser(null);
      }
    } catch (err) {
      setSearchResults([]);
      setShowDropdown(false);
      setFoundUser(null);
    }
  };

  // Select a user from the dropdown
  const selectUser = (user) => {
    setFoundUser(user);
    setNewPersonForm(prev => ({
      ...prev,
      username: user.username,
      phone: user.phone || prev.phone
    }));
    setShowDropdown(false);
    setSearchResults([]);
  };

  // =============================================================================
  // 5. ADD PERSON TO QUEUE - IMPROVED ERROR HANDLING
  // =============================================================================
  const addPersonToQueue = async (e) => {
    e.preventDefault();
    
    if (!newPersonForm.username.trim()) {
      showModal('warning', 'Username Required', 'Please enter a username before adding to queue.');
      return;
    }

    setAddingPerson(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({
          userName: newPersonForm.username.trim(),
          phoneNumber: newPersonForm.phone.trim() || null,
          notes: newPersonForm.notes.trim() || null,
          computerType: newPersonForm.computerType,
          isPhysical: true,
          userId: foundUser?.id || null
        })
      });

      if (response.ok) {
        showModal('success', 'Person Added', `${newPersonForm.username} has been successfully added to the queue!`);
        setNewPersonForm({ username: '', phone: '', notes: '', computerType: 'any' });
        setFoundUser(null);
        setShowAddForm(false);
        
        // Immediate refresh
        loadQueueData(0, false);
      } else {
        const error = await response.json();
        showModal('error', 'Failed to Add Person', error.error || 'An error occurred while adding person to queue.');
      }
    } catch (error) {
      showModal('error', 'Failed to Add Person', 'An error occurred while adding person to queue.');
    } finally {
      setAddingPerson(false);
    }
  };

  // =============================================================================
  // 6. REMOVE PERSON FROM QUEUE - IMPROVED WITH OPTIMISTIC UPDATES
  // =============================================================================
  const removePerson = (id, name) => {
    showModal('confirm', 'Remove Person', `Are you sure you want to remove ${name} from the queue?`, () => {
      executeRemovePerson(id, name);
    });
  };

  const executeRemovePerson = async (id, name) => {
    setRemovingPerson(id);
    
    // Optimistic update - remove from UI immediately
    const previousQueueList = [...queueList];
    const updatedQueue = previousQueueList.filter(person => person.id !== id);
    setQueueList(updatedQueue);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`/api/queue/manage?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionData?.session?.access_token}` }
      });

      if (response.ok) {
        showModal('success', 'Person Removed', `${name} has been successfully removed from the queue.`);
        
        // Refresh to ensure positions are correct
        setTimeout(() => {
          loadQueueData(0, false);
        }, 500);
      } else {
        // Revert optimistic update on error
        setQueueList(previousQueueList);
        showModal('error', 'Failed to Remove Person', 'An error occurred while removing person from queue.');
      }
    } catch (error) {
      // Revert optimistic update on error
      setQueueList(previousQueueList);
      showModal('error', 'Failed to Remove Person', 'An error occurred while removing person from queue.');
    } finally {
      setRemovingPerson(null);
    }
  };

  // =============================================================================
  // 7. REORDER QUEUE MANUALLY - IMPROVED WITH OPTIMISTIC UPDATES
  // =============================================================================
  const movePersonInQueue = async (personId, direction) => {
    setMovingPerson(personId);
    
    // Optimistic update - swap positions immediately in UI
    const currentIndex = queueList.findIndex(p => p.id === personId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= queueList.length) {
      setMovingPerson(null);
      return;
    }
    
    const previousQueueList = [...queueList];
    const newQueueList = [...queueList];
    
    // Swap the two people
    [newQueueList[currentIndex], newQueueList[newIndex]] = [newQueueList[newIndex], newQueueList[currentIndex]];
    
    // Update positions
    newQueueList[currentIndex].position = currentIndex + 1;
    newQueueList[newIndex].position = newIndex + 1;
    
    setQueueList(newQueueList);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({ 
          personId, 
          direction
        })
      });

      if (response.ok) {
        // Refresh to ensure data is in sync
        setTimeout(() => {
          loadQueueData(0, false);
        }, 500);
      } else {
        // Revert optimistic update on error
        setQueueList(previousQueueList);
        showModal('error', 'Reorder Failed', 'Failed to reorder queue. Please try again.');
      }
    } catch (error) {
      console.error('Error reordering queue:', error);
      // Revert optimistic update on error
      setQueueList(previousQueueList);
      showModal('error', 'Reorder Failed', 'Failed to reorder queue. Please try again.');
    } finally {
      setMovingPerson(null);
    }
  };

  // Check authentication and admin/staff permissions
  useEffect(() => {
    if (!authLoading && (!user || (!user.isAdmin && !user.isStaff))) {
      toast.error('You do not have permission to access this page');
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Load data when page opens and set up real-time subscriptions - IMPROVED
  useEffect(() => {
    if (user && supabase) {
      loadQueueData();
      
      // Set up real-time subscriptions for queue changes - IMMEDIATE UPDATES
      const queueSubscription = supabase
        .channel('admin-queue-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'computer_queue'
        }, (payload) => {
          console.log(`📡 Queue data changed (${payload.eventType}), refreshing admin view...`);
          // Immediate refresh - no debouncing
          loadQueueData(0, false);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'queue_settings'
        }, (payload) => {
          console.log(`📡 Queue settings changed (${payload.eventType}), refreshing admin view...`);
          // Immediate refresh - no debouncing
          loadQueueData(0, false);
        })
        .subscribe();
      
      // Reduced backup polling frequency since we have better real-time updates
      const interval = setInterval(() => loadQueueData(0, false), 30000); // Every 30 seconds
      
      return () => {
        queueSubscription.unsubscribe();
        clearInterval(interval);
      };
    }
  }, [user, supabase]);

  // Show loading state while checking auth - OUTSIDE AdminPageWrapper
  if (authLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Don't render anything if not admin or staff
  if (!user?.isAdmin && !user?.isStaff) {
    return null;
  }

  if (loading) {
    return (
      <AdminPageWrapper title="Queue Management">
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading queue...</p>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper title="Queue Management">
      <Head>
        <title>Queue Management | Admin Panel</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={styles.queueAdmin}>
        
        {/* =================================================================== */}
        {/* MAIN CONTROLS - Start/Stop Queue & Allow/Block Online Users */}
        {/* =================================================================== */}
        <div className={styles.mainControls}>
          <div className={styles.controlCard}>
            <h3>Queue System Control</h3>
            <p>Turn the queue system on or off for your gaming center</p>
            <button
              className={`${styles.bigButton} ${queueActive ? styles.stopButton : styles.startButton}`}
              onClick={toggleQueueSystem}
              disabled={saving}
            >
              {queueActive ? <FaStop /> : <FaPlay />}
              {queueActive ? 'Stop Queue System' : 'Start Queue System'}
            </button>
            <div className={styles.status}>
              Status: <strong>{queueActive ? 'ACTIVE' : 'INACTIVE'}</strong>
            </div>
          </div>

          <div className={styles.controlCard}>
            <h3>Online User Access</h3>
            <p>Allow or block people from joining the queue online</p>
            <button
              className={`${styles.bigButton} ${onlineJoiningAllowed ? styles.blockButton : styles.allowButton}`}
              onClick={toggleOnlineJoining}
              disabled={saving || !queueActive}
            >
              {onlineJoiningAllowed ? <FaEyeSlash /> : <FaEye />}
              {onlineJoiningAllowed ? 'Block Online Joining' : 'Allow Online Joining'}
            </button>
            <div className={styles.status}>
              Online Access: <strong>{onlineJoiningAllowed ? 'ALLOWED' : 'BLOCKED'}</strong>
            </div>
          </div>

          <div className={styles.controlCard}>
            <h3>Automatic Mode</h3>
            <p>Auto turn ON queue when people join, auto turn OFF when empty</p>
            <button
              className={`${styles.bigButton} ${automaticMode ? styles.autoOnButton : styles.autoOffButton}`}
              onClick={toggleAutomaticMode}
              disabled={saving}
            >
              {automaticMode ? <FaCogs /> : <FaCog />}
              {automaticMode ? 'Automatic Mode ON' : 'Enable Automatic Mode'}
            </button>
            <div className={styles.status}>
              Auto Control: <strong>{automaticMode ? 'ENABLED' : 'DISABLED'}</strong>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* QUEUE STATISTICS */}
        {/* =================================================================== */}
        <div className={styles.statsSection}>
          <div className={styles.statCard}>
            <FaUsers />
            <div>
              <div className={styles.statNumber}>{queueList.length}</div>
              <div className={styles.statLabel}>Total in Queue</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <FaDesktop />
            <div>
              <div className={styles.statNumber}>
                {queueList.filter(p => p.is_physical).length}
              </div>
              <div className={styles.statLabel}>Physical Waiters</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <FaClock />
            <div>
              <div className={styles.statNumber}>
                {queueList.filter(p => !p.is_physical).length}
              </div>
              <div className={styles.statLabel}>Online Waiters</div>
            </div>
          </div>
          
          {/* Add refresh indicator */}
          {refreshing && (
            <div className={styles.statCard}>
              <div className={styles.spinner}></div>
              <div>
                <div className={styles.statLabel}>Refreshing...</div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* ADD PERSON BUTTON & FORM */}
        {/* =================================================================== */}
        <div className={styles.addSection}>
          {!showAddForm ? (
            <button 
              className={styles.showAddButton}
              onClick={() => setShowAddForm(true)}
              disabled={!queueActive && !automaticMode}
            >
              <FaUserPlus /> Add Person Who's Here Physically
            </button>
          ) : (
            <div className={styles.addForm}>
              <div className={styles.addFormHeader}>
                <h3>Add Person to Queue</h3>
                <p>Use this when someone comes to your gaming center and wants to join the queue</p>
                <button 
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowAddForm(false);
                    setNewPersonForm({ username: '', phone: '', notes: '', computerType: 'any' });
                    setFoundUser(null);
                    setSearchResults([]);
                    setShowDropdown(false);
                  }}
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={addPersonToQueue}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Username *</label>
                    <div className={styles.searchContainer}>
                      <input
                        type="text"
                        value={newPersonForm.username}
                        onChange={(e) => {
                          setNewPersonForm({ ...newPersonForm, username: e.target.value });
                          // Search after user stops typing for 500ms
                          clearTimeout(window.searchTimeout);
                          window.searchTimeout = setTimeout(() => searchUsers(e.target.value), 500);
                        }}
                        onFocus={() => {
                          if (searchResults.length > 0) setShowDropdown(true);
                        }}
                        onBlur={() => {
                          // Delay hiding dropdown to allow clicks on dropdown items
                          setTimeout(() => setShowDropdown(false), 200);
                        }}
                        placeholder="Type to search for username..."
                        required
                        disabled={addingPerson}
                      />
                      
                      {/* Dropdown list of matching users */}
                      {showDropdown && searchResults.length > 0 && (
                        <div className={styles.searchDropdown}>
                          {searchResults.map(user => (
                            <div
                              key={user.id}
                              className={styles.searchResult}
                              onClick={() => selectUser(user)}
                            >
                              <div className={styles.resultMain}>
                                <strong>{user.username}</strong>
                                {user.phone && <span className={styles.resultPhone}>📞 {user.phone}</span>}
                              </div>
                              <div className={styles.resultEmail}>{user.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {foundUser && (
                        <div className={styles.userFound}>
                          ✓ Selected: {foundUser.username} ({foundUser.email})
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label><FaPhone /> Phone Number</label>
                    <input
                      type="tel"
                      value={newPersonForm.phone}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, phone: e.target.value })}
                      placeholder={foundUser ? "Auto-filled" : "Optional phone number"}
                      disabled={addingPerson}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Computer Preference</label>
                    <select
                      value={newPersonForm.computerType}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, computerType: e.target.value })}
                      disabled={addingPerson}
                    >
                      <option value="any">Any Available Computer</option>
                      <option value="top">Top Floor Only</option>
                      <option value="bottom">Bottom Floor Only</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label><FaStickyNote /> Notes</label>
                    <input
                      type="text"
                      value={newPersonForm.notes}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, notes: e.target.value })}
                      placeholder="Any special notes (optional)"
                      disabled={addingPerson}
                    />
                  </div>
                </div>

                <button type="submit" className={styles.addSubmitButton} disabled={addingPerson}>
                  {addingPerson ? 'Adding...' : 'Add to Queue'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* CURRENT QUEUE LIST */}
        {/* =================================================================== */}
        <div className={styles.queueSection}>
          <div className={styles.queueHeader}>
            <h3>Current Queue ({queueList.length} people waiting)</h3>
            {refreshing && <div className={styles.refreshIndicator}>Updating...</div>}
          </div>
          
          {queueList.length === 0 ? (
            <div className={styles.emptyQueue}>
              <p>No one is currently waiting in the queue</p>
            </div>
          ) : (
            <div className={styles.queueList}>
              {queueList.map((person, index) => (
                <div 
                  key={person.id} 
                  className={`${styles.queuePerson} ${removingPerson === person.id ? styles.removing : ''} ${movingPerson === person.id ? styles.moving : ''}`}
                >
                  <div className={styles.personPosition}>
                    {person.position}
                  </div>
                  
                  <div className={styles.personDetails}>
                    <div className={styles.personName}>
                      {person.user_name}
                      <span className={`${styles.personType} ${person.is_physical ? styles.physical : styles.online}`}>
                        {person.is_physical ? 'HERE' : 'ONLINE'}
                      </span>
                      {(person.display_phone || person.phone_number || person.phone || person.user_phone) && (
                        <span className={styles.personType} style={{backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7'}}>
                          📞 {person.display_phone || person.phone_number || person.phone || person.user_phone}
                        </span>
                      )}
                    </div>
                    
                    <div className={styles.personInfo}>
                      <span>Wants: {person.computer_type === 'any' ? 'Any Computer' : `${person.computer_type.charAt(0).toUpperCase() + person.computer_type.slice(1)} Floor Only`}</span>
                      <span>Added: {new Date(person.created_at).toLocaleTimeString()}</span>
                    </div>
                    
                    {person.notes && (
                      <div className={styles.personNotes}>📝 {person.notes}</div>
                    )}
                    
                    {/* Show operation status */}
                    {removingPerson === person.id && (
                      <div className={styles.operationStatus}>Removing...</div>
                    )}
                    {movingPerson === person.id && (
                      <div className={styles.operationStatus}>Moving...</div>
                    )}
                  </div>
                  
                  <div className={styles.queueActions}>
                    {/* Position change buttons - only show if there are multiple people */}
                    {queueList.length > 1 && (
                      <div className={styles.positionControls}>
                        <button
                          className={styles.positionButton}
                          onClick={() => movePersonInQueue(person.id, 'up')}
                          disabled={index === 0 || movingPerson === person.id || removingPerson === person.id}
                          title={`Move ${person.user_name} to position ${person.position - 1}`}
                        >
                          {movingPerson === person.id ? '...' : '↑ Move Up'}
                        </button>
                        <button
                          className={`${styles.positionButton} ${styles.moveDown}`}
                          onClick={() => movePersonInQueue(person.id, 'down')}
                          disabled={index === queueList.length - 1 || movingPerson === person.id || removingPerson === person.id}
                          title={`Move ${person.user_name} to position ${person.position + 1}`}
                        >
                          {movingPerson === person.id ? '...' : '↓ Move Down'}
                        </button>
                      </div>
                    )}
                    
                    <button
                      className={styles.removeButton}
                      onClick={() => removePerson(person.id, person.user_name)}
                      title={`Remove ${person.user_name} from queue`}
                      disabled={removingPerson === person.id || movingPerson === person.id}
                    >
                      <FaTrash /> {removingPerson === person.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* HELP SECTION */}
        {/* =================================================================== */}
        <div className={styles.helpSection}>
          <h3>How to Use This Queue System</h3>
          <div className={styles.helpCards}>
            <div className={styles.helpCard}>
              <h4>1. Start the Queue</h4>
              <p>Click "Start Queue System" when all computers are busy and people are waiting</p>
            </div>
            <div className={styles.helpCard}>
              <h4>2. Add Physical Waiters</h4>
              <p>When someone comes to your gaming center, add them using "Add Person" button</p>
            </div>
            <div className={styles.helpCard}>
              <h4>3. Control Online Access</h4>
              <p>Block online joining if you want only physical waiters, or allow it for both</p>
            </div>
            <div className={styles.helpCard}>
              <h4>4. Manage the Queue</h4>
              <p>Remove people when they get a computer or leave. The queue auto-reorders.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Component */}
      <QueueAdminModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        autoClose={modal.type === 'success' ? true : false}
        autoCloseDelay={2500}
      />
    </AdminPageWrapper>
  );
}

// 🛡️ SERVER-SIDE PROTECTION: Require staff or admin privileges
export const getServerSideProps = withServerSideStaff();