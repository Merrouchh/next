import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import AdminPageWrapper from '../../../components/AdminPageWrapper';
import { fetchGizmoId } from '../../../utils/api';
import styles from '../../../styles/AdminUsers.module.css';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { AiOutlineCopy, AiOutlineSync, AiOutlineSearch, AiOutlineUser, AiOutlineDelete, AiOutlineGift } from 'react-icons/ai';
import { withServerSideAdmin } from '../../../utils/supabase/server-admin';

export default function AdminUsers() {
  const { user, loading: authLoading, supabase } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [gizmoId, setGizmoId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Username sync state
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showSyncResults, setShowSyncResults] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [showGiftHoursModal, setShowGiftHoursModal] = useState(false);
  const [giftHoursUser, setGiftHoursUser] = useState(null);
  const [giftHours, setGiftHours] = useState('');
  const [giftHoursLoading, setGiftHoursLoading] = useState(false);

  // Use client-side user data
  const currentUser = user;

  // Server-side check should prevent access, but keep client-side as backup
  useEffect(() => {
    if (!authLoading && (!currentUser || !currentUser.isAdmin)) {
      toast.error('You do not have permission to access this page');
      router.push('/');
    }
  }, [currentUser, authLoading, router]);

  // Load users from API
  const loadUsers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/admin/sync-usernames?page=${currentPage}&limit=10&search=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error loading users');
    }
  }, [supabase, currentPage, searchTerm]);

  // Load users when search term changes
  useEffect(() => {
    if (currentUser?.isAdmin && searchTerm.trim()) {
      loadUsers();
    } else if (currentUser?.isAdmin && !searchTerm.trim()) {
      // Clear users when search is empty
      setUsers([]);
      setTotalPages(1);
    }
  }, [currentUser, searchTerm, loadUsers]);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    if (searchTerm.trim()) {
      loadUsers();
    }
  };

  // Handle user selection
  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user.id));
    }
  };

  // Sync selected users
  const handleSyncSelected = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users to sync');
      return;
    }

    setSyncLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/sync-usernames', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: selectedUsers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSyncResults(data.results);
        setShowSyncResults(true);
        setSelectedUsers([]);
        loadUsers(); // Refresh the user list
        toast.success(`Synced ${data.results.synced} users successfully`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to sync usernames');
      }
    } catch (error) {
      console.error('Error syncing usernames:', error);
      toast.error('Error syncing usernames');
    } finally {
      setSyncLoading(false);
    }
  };

  // Sync all users
  const handleSyncAll = async () => {
    if (!confirm('Are you sure you want to sync ALL users? This may take a while.')) {
      return;
    }

    setSyncLoading(true);
    setSyncProgress({ current: 0, total: 0, message: 'Starting sync...' });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast.error('Authentication required');
        return;
      }

      // First, get the total count of users to sync
      setSyncProgress({ current: 0, total: 0, message: 'Counting users...' });
      const countResponse = await fetch('/api/admin/sync-usernames?page=1&limit=1&search=', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      let totalUsers = 0;
      if (countResponse.ok) {
        const countData = await countResponse.json();
        totalUsers = countData.pagination?.total || 0;
        setSyncProgress({ current: 0, total: totalUsers, message: `Found ${totalUsers} users to sync...` });
      }

      // Start progress simulation
      let progressInterval;
      let currentProgress = 0;
      
      const simulateProgress = () => {
        progressInterval = setInterval(() => {
          if (currentProgress < totalUsers * 0.9) { // Stop at 90% to wait for actual completion
            currentProgress += Math.max(1, Math.floor(totalUsers / 100)); // Increment by 1% of total
            setSyncProgress(prev => ({
              ...prev,
              current: Math.min(currentProgress, totalUsers),
              message: `Syncing usernames... ${Math.min(currentProgress, totalUsers)}/${totalUsers}`
            }));
          }
        }, 200); // Update every 200ms
      };

      // Start the actual sync
      setSyncProgress(prev => ({ ...prev, message: 'Syncing usernames...' }));
      simulateProgress();
      
      const response = await fetch('/api/admin/sync-usernames', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncAll: true
        })
      });

      // Clear the progress simulation
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (response.ok) {
        const data = await response.json();
        setSyncProgress({ current: totalUsers, total: totalUsers, message: 'Sync completed!' });
        setSyncResults(data.results);
        setShowSyncResults(true);
        loadUsers(); // Refresh the user list
        toast.success(`Synced ${data.results.synced} users successfully`);
        
        // Clear progress after a short delay
        setTimeout(() => {
          setSyncProgress(null);
        }, 2000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to sync usernames');
        setSyncProgress(null);
      }
    } catch (error) {
      console.error('Error syncing all usernames:', error);
      toast.error('Error syncing usernames');
      setSyncProgress(null);
    } finally {
      setSyncLoading(false);
    }
  };

  // Sync single user
  const handleSyncSingle = async (userId) => {
    setSyncLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/sync-usernames', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data.updated) {
          toast.success(`Username updated from "${data.data.oldUsername}" to "${data.data.newUsername}"`);
        } else {
          toast.success('Username is already up to date');
        }
        loadUsers(); // Refresh the user list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to sync username');
      }
    } catch (error) {
      console.error('Error syncing single username:', error);
      toast.error('Error syncing username');
    } finally {
      setSyncLoading(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userToDelete.id
        })
      });

      if (response.ok) {
        toast.success(`User "${userToDelete.username}" deleted successfully`);
        loadUsers(); // Refresh the user list
        setShowDeleteModal(false);
        setUserToDelete(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error deleting user');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Gift Hours functionality
  const handleGiftHours = (user) => {
    setGiftHoursUser(user);
    setGiftHours('');
    setShowGiftHoursModal(true);
  };

  const confirmGiftHours = async () => {
    if (!giftHoursUser || !giftHours || isNaN(parseFloat(giftHours)) || parseFloat(giftHours) <= 0) {
      toast.error('Please enter a valid number of hours');
      return;
    }

    setGiftHoursLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/gift-hours', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: giftHoursUser.id,
          hours: parseFloat(giftHours)
        })
      });

      if (response.ok) {
        toast.success(`Successfully gifted ${giftHours} hours to ${giftHoursUser.username}`);
        setShowGiftHoursModal(false);
        setGiftHoursUser(null);
        setGiftHours('');
        // Removed undefined setters for gift hours search state
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to gift hours');
      }
    } catch (error) {
      console.error('Error gifting hours:', error);
      toast.error('Error gifting hours');
    } finally {
      setGiftHoursLoading(false);
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  // Don't render anything if not admin
  if (!currentUser?.isAdmin) {
    return null;
  }

  const handleGizmoIdLookup = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setIsLoading(true);
    try {
      const { gizmoId } = await fetchGizmoId(username);
      if (gizmoId) {
        setGizmoId(gizmoId);
        toast.success('Gizmo ID found!');
      } else {
        setGizmoId(null);
        toast.error('No Gizmo ID found for this username');
      }
    } catch (error) {
      console.error('Error fetching Gizmo ID:', error);
      toast.error('Failed to fetch Gizmo ID');
      setGizmoId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyGizmoId = async () => {
    try {
      await navigator.clipboard.writeText(gizmoId);
      toast.success('Gizmo ID copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy Gizmo ID');
    }
  };

  return (
    <AdminPageWrapper>
      <div className={styles.container}>
        <h1 className={styles.title}>User Management</h1>
        

        {/* Username Synchronization Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <AiOutlineSync /> Username Synchronization
          </h2>
          <div className={styles.toolCard}>
            <p className={styles.description}>
              Sync usernames from Gizmo to keep them up to date. Users who changed their usernames in Gizmo 
              will have their website usernames updated automatically.
            </p>
            
            {/* Search and Filter */}
            <form onSubmit={handleSearch} className={styles.searchForm}>
              <div className={styles.searchGroup}>
                <AiOutlineSearch className={styles.searchIcon} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users by username or email..."
                  className={styles.searchInput}
                />
                <button type="submit" className={styles.searchButton}>
                  Search
                </button>
              </div>
            </form>

            {/* Bulk Actions */}
            <div className={styles.bulkActions}>
              <button
                onClick={handleSelectAll}
                className={styles.selectAllButton}
                disabled={users.length === 0}
              >
                {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleSyncSelected}
                className={styles.syncButton}
                disabled={selectedUsers.length === 0 || syncLoading}
              >
                <AiOutlineSync />
                Sync Selected ({selectedUsers.length})
              </button>
              <button
                onClick={handleSyncAll}
                className={styles.syncAllButton}
                disabled={syncLoading}
              >
                <AiOutlineSync />
                Sync All Users
              </button>
            </div>

            {/* Progress Bar */}
            {syncProgress && (
              <div className={styles.progressContainer}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressMessage}>{syncProgress.message}</span>
                  {syncProgress.total > 0 && (
                    <span className={styles.progressCount}>
                      {syncProgress.current} / {syncProgress.total}
                    </span>
                  )}
                </div>
                {syncProgress.total > 0 && (
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{ 
                        width: `${(syncProgress.current / syncProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Users List */}
            <div className={styles.usersList}>
              {!searchTerm.trim() ? (
                <div className={styles.noSearchMessage}>
                  <AiOutlineSearch className={styles.searchIcon} />
                  <h3>Search for Users</h3>
                  <p>Enter a username or email in the search box above to find and manage users.</p>
                </div>
              ) : (
                <>
                  <div className={styles.usersHeader}>
                    <div className={styles.headerCheckbox}>
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedUsers.length === users.length}
                        onChange={handleSelectAll}
                      />
                    </div>
                    <div className={styles.headerUsername}>Username</div>
                    <div className={styles.headerEmail}>Email</div>
                    <div className={styles.headerPhone}>Phone</div>
                    <div className={styles.headerGizmoId}>Gizmo ID</div>
                    <div className={styles.headerActions}>Actions</div>
                  </div>
                  
                  {users.map((user) => (
                <div key={user.id} className={styles.userRow}>
                  <div className={styles.userCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleUserSelect(user.id)}
                    />
                  </div>
                  <div className={styles.userUsername}>
                    <AiOutlineUser className={styles.userIcon} />
                    {user.username}
                  </div>
                  <div className={styles.userEmail}>{user.email}</div>
                  <div className={styles.userPhone}>{user.phone || 'N/A'}</div>
                  <div className={styles.userGizmoId}>{user.gizmo_id}</div>
                  <div className={styles.userActions}>
                    <button
                      onClick={() => handleSyncSingle(user.id)}
                      className={styles.syncSingleButton}
                      disabled={syncLoading}
                      title="Sync this user's username"
                    >
                      <AiOutlineSync />
                    </button>
                    <button
                      onClick={() => handleGiftHours(user)}
                      className={styles.giftSmallButton}
                      disabled={giftHoursLoading}
                      title="Gift hours to this user"
                    >
                      <AiOutlineGift />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className={styles.deleteButton}
                      disabled={deleteLoading}
                      title="Delete this user"
                    >
                      <AiOutlineDelete />
                    </button>
                  </div>
                </div>
                  ))}
                  
                  {users.length === 0 && (
                    <div className={styles.noUsers}>
                      No users found. Try adjusting your search terms.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={styles.paginationButton}
                >
                  Previous
                </button>
                <span className={styles.paginationInfo}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={styles.paginationButton}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Sync Results Modal */}
        {showSyncResults && syncResults && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Sync Results</h3>
                <button
                  onClick={() => setShowSyncResults(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalContent}>
                <div className={styles.resultsSummary}>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Total Processed:</span>
                    <span className={styles.resultValue}>{syncResults.total}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Successfully Synced:</span>
                    <span className={`${styles.resultValue} ${styles.success}`}>{syncResults.synced}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Updated:</span>
                    <span className={`${styles.resultValue} ${styles.updated}`}>{syncResults.updated}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Unchanged:</span>
                    <span className={`${styles.resultValue} ${styles.unchanged}`}>{syncResults.unchanged}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <span className={styles.resultLabel}>Failed:</span>
                    <span className={`${styles.resultValue} ${styles.failed}`}>{syncResults.failed}</span>
                  </div>
                </div>
                
                {syncResults.errors && syncResults.errors.length > 0 && (
                  <div className={styles.errorsSection}>
                    <h4>Errors:</h4>
                    <div className={styles.errorsList}>
                      {syncResults.errors.map((error, index) => (
                        <div key={index} className={styles.errorItem}>
                          <strong>{error.username}:</strong> {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setShowSyncResults(false)}
                  className={styles.closeModalButton}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Gizmo ID Lookup Tool */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gizmo ID Lookup Tool</h2>
          <div className={styles.toolCard}>
            <form onSubmit={handleGizmoIdLookup} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className={styles.input}
                />
              </div>
              <button 
                type="submit" 
                className={styles.button}
                disabled={isLoading}
              >
                {isLoading ? 'Looking up...' : 'Lookup Gizmo ID'}
              </button>
            </form>

            {gizmoId && (
              <div className={styles.result}>
                <h3>Result:</h3>
                <div className={styles.resultCard}>
                  <p><strong>Username:</strong> {username}</p>
                  <p className={styles.gizmoIdRow}>
                    <strong>Gizmo ID:</strong>
                    <span className={styles.gizmoIdValue}>
                      {gizmoId}
                      <button 
                        onClick={handleCopyGizmoId}
                        className={styles.copyButton}
                        title="Copy Gizmo ID"
                      >
                        <AiOutlineCopy />
                      </button>
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Delete User</h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                <p>Are you sure you want to delete this user?</p>
                <div className={styles.userInfo}>
                  <strong>Username:</strong> {userToDelete?.username}<br />
                  <strong>Email:</strong> {userToDelete?.email}<br />
                  <strong>Gizmo ID:</strong> {userToDelete?.gizmo_id}
                </div>
                <p className={styles.warning}>
                  ⚠️ This action cannot be undone. All user data, clips, and related information will be permanently deleted.
                </p>
              </div>
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className={styles.cancelButton}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className={styles.confirmDeleteButton}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gift Hours Modal */}
        {showGiftHoursModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Gift Hours</h3>
                <button
                  onClick={() => setShowGiftHoursModal(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                <p>Gift hours to this user:</p>
                <div className={styles.userInfo}>
                  <strong>Username:</strong> {giftHoursUser?.username}<br />
                  <strong>Email:</strong> {giftHoursUser?.email}<br />
                  <strong>Gizmo ID:</strong> {giftHoursUser?.gizmo_id}
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="giftHours">Hours to Gift</label>
                  <input
                    type="number"
                    id="giftHours"
                    value={giftHours}
                    onChange={(e) => setGiftHours(e.target.value)}
                    placeholder="Enter number of hours"
                    className={styles.input}
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <p className={styles.info}>
                  ℹ️ This will add the specified hours to the user&apos;s available time.
                </p>
              </div>
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setShowGiftHoursModal(false)}
                  className={styles.cancelButton}
                  disabled={giftHoursLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmGiftHours}
                  className={styles.giftButton}
                  disabled={giftHoursLoading}
                >
                  {giftHoursLoading ? 'Gifting...' : 'Gift Hours'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
}

// Server-side authentication check - requires admin privileges
export const getServerSideProps = withServerSideAdmin(true); 