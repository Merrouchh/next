import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import Head from 'next/head';
import styles from '../../styles/AdminQueue.module.css';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { 
  FaPlay, FaStop, FaUserPlus, FaTrash, FaEye, FaEyeSlash,
  FaUsers, FaClock, FaDesktop, FaPhone, FaStickyNote, FaCog, FaCogs 
} from 'react-icons/fa';

export default function AdminQueue() {
  const { user, supabase, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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

  // =============================================================================
  // 1. LOAD QUEUE DATA (runs when page loads)
  // =============================================================================
  const loadQueueData = async () => {
    try {
      const response = await fetch('/api/queue/status');
      if (response.ok) {
        const data = await response.json();
        console.log('Queue status response:', data.status); // Debug log
        
        // The status is an array, get the first element
        const status = Array.isArray(data.status) ? data.status[0] : data.status;
        console.log('Status object:', status); // Debug log
        
        setQueueActive(status.is_active);
        setOnlineJoiningAllowed(status.allow_online_joining);
        
        // Load automatic mode setting from database
        console.log('Automatic mode from DB:', status.automatic_mode); // Debug log
        if (status.automatic_mode !== undefined) {
          setAutomaticMode(status.automatic_mode);
          console.log('Set automatic mode to:', status.automatic_mode);
        } else {
          console.log('automatic_mode field not found in response');
        }
        
        const newQueueList = data.queue || [];
        setQueueList(newQueueList);
        
        // Auto-control queue if automatic mode is enabled
        // Use the automatic mode from the database response
        if (status.automatic_mode) {
          autoControlQueue(newQueueList.length, status.automatic_mode);
        }
      }
    } catch (error) {
      console.error('Error loading queue:', error);
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // 2. START/STOP QUEUE SYSTEM
  // =============================================================================
  const toggleQueueSystem = async () => {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/manage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({ isActive: !queueActive })
      });

      if (response.ok) {
        setQueueActive(!queueActive);
        alert(queueActive ? 'Queue system stopped' : 'Queue system started');
      } else {
        alert('Error updating queue system');
      }
    } catch (error) {
      alert('Error updating queue system');
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // 3. TOGGLE AUTOMATIC MODE (auto on/off based on queue count)
  // =============================================================================
  const toggleAutomaticMode = async () => {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/manage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({ automaticMode: !automaticMode })
      });

      if (response.ok) {
        setAutomaticMode(!automaticMode);
        if (!automaticMode) {
          alert('Automatic mode enabled: Queue will turn ON when people join and OFF when empty');
        } else {
          alert('Automatic mode disabled: Manual control restored');
        }
      } else {
        alert('Error updating automatic mode');
      }
    } catch (error) {
      alert('Error updating automatic mode');
    } finally {
      setSaving(false);
    }
  };

  // Auto-control queue system based on queue count (when automatic mode is on)
  const autoControlQueue = async (currentQueueCount, isAutomaticMode = automaticMode) => {
    if (!isAutomaticMode) return;

    const shouldBeActive = currentQueueCount > 0;
    
    if (shouldBeActive && !queueActive) {
      // Auto-start queue when people join
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch('/api/queue/manage', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token}`
          },
          body: JSON.stringify({ isActive: true })
        });
        if (response.ok) {
          setQueueActive(true);
        }
      } catch (error) {
        console.error('Auto-start queue error:', error);
      }
    } else if (!shouldBeActive && queueActive) {
      // Auto-stop queue when empty
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch('/api/queue/manage', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token}`
          },
          body: JSON.stringify({ isActive: false })
        });
        if (response.ok) {
          setQueueActive(false);
        }
      } catch (error) {
        console.error('Auto-stop queue error:', error);
      }
    }
  };

  // =============================================================================
  // 4. ALLOW/BLOCK ONLINE USERS FROM JOINING
  // =============================================================================
  const toggleOnlineJoining = async () => {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/queue/manage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token}`
        },
        body: JSON.stringify({ allowOnlineJoining: !onlineJoiningAllowed })
      });

      if (response.ok) {
        setOnlineJoiningAllowed(!onlineJoiningAllowed);
        alert(onlineJoiningAllowed ? 'Online joining blocked' : 'Online joining allowed');
      } else {
        alert('Error updating settings');
      }
    } catch (error) {
      alert('Error updating settings');
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
  // 5. ADD PERSON TO QUEUE (they're physically here)
  // =============================================================================
  const addPersonToQueue = async (e) => {
    e.preventDefault();
    
    if (!newPersonForm.username.trim()) {
      alert('Please enter a username');
      return;
    }

    // If automatic mode is on and queue is not active, start it first
    if (automaticMode && !queueActive) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        await fetch('/api/queue/manage', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token}`
          },
          body: JSON.stringify({ isActive: true })
        });
        setQueueActive(true);
      } catch (error) {
        console.error('Error auto-starting queue:', error);
      }
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
        alert('Person added to queue!');
        setNewPersonForm({ username: '', phone: '', notes: '', computerType: 'any' });
        setFoundUser(null);
        setShowAddForm(false);
        loadQueueData(); // Refresh the list
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Error adding person to queue');
    } finally {
      setAddingPerson(false);
    }
  };

  // =============================================================================
  // 6. REMOVE PERSON FROM QUEUE
  // =============================================================================
  const removePerson = async (id, name) => {
    if (!confirm(`Remove ${name} from the queue?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`/api/queue/manage?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionData?.session?.access_token}` }
      });

      if (response.ok) {
        alert(`${name} removed from queue`);
        loadQueueData(); // Refresh the list
      } else {
        alert('Error removing person');
      }
    } catch (error) {
      alert('Error removing person');
    }
  };

  // Check authentication and admin/staff permissions
  useEffect(() => {
    if (!authLoading && (!user || (!user.isAdmin && !user.isStaff))) {
      toast.error('You do not have permission to access this page');
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Load data when page opens and set up real-time subscriptions
  useEffect(() => {
    if (user && supabase) {
      loadQueueData();
      
      // Set up real-time subscriptions for queue changes
      const queueSubscription = supabase
        .channel('admin-queue-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'computer_queue'
        }, () => {
          console.log('Queue data changed, refreshing admin view...');
          loadQueueData();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'queue_settings'
        }, () => {
          console.log('Queue settings changed, refreshing admin view...');
          loadQueueData();
        })
        .subscribe();
      
      // Backup polling every 30 seconds (reduced frequency since we have realtime)
      const interval = setInterval(loadQueueData, 30000);
      
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
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Computer Preference</label>
                    <select
                      value={newPersonForm.computerType}
                      onChange={(e) => setNewPersonForm({ ...newPersonForm, computerType: e.target.value })}
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
          <h3>Current Queue ({queueList.length} people waiting)</h3>
          
          {queueList.length === 0 ? (
            <div className={styles.emptyQueue}>
              <p>No one is currently waiting in the queue</p>
            </div>
          ) : (
            <div className={styles.queueList}>
              {queueList.map((person) => (
                <div key={person.id} className={styles.queuePerson}>
                  <div className={styles.personPosition}>
                    {person.position}
                  </div>
                  
                  <div className={styles.personDetails}>
                    <div className={styles.personName}>
                      {person.user_name}
                      <span className={`${styles.personType} ${person.is_physical ? styles.physical : styles.online}`}>
                        {person.is_physical ? 'HERE' : 'ONLINE'}
                      </span>
                    </div>
                    
                    <div className={styles.personInfo}>
                      <span>Computer: {person.computer_type}</span>
                      {person.phone_number && <span>Phone: {person.phone_number}</span>}
                      <span>Added: {new Date(person.created_at).toLocaleTimeString()}</span>
                    </div>
                    
                    {person.notes && (
                      <div className={styles.personNotes}>{person.notes}</div>
                    )}
                  </div>
                  
                  <button
                    className={styles.removeButton}
                    onClick={() => removePerson(person.id, person.user_name)}
                    title="Remove from queue"
                  >
                    <FaTrash />
                  </button>
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
    </AdminPageWrapper>
  );
} 