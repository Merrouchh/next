import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import AdminPageWrapper from '../../../components/AdminPageWrapper';
import { fetchGizmoId } from '../../../utils/api';
import styles from '../../../styles/AdminUsers.module.css';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { AiOutlineCopy } from 'react-icons/ai';
import { withServerSideAdmin } from '../../../utils/supabase/server-admin';

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [gizmoId, setGizmoId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use client-side user data
  const currentUser = user;

  // Server-side check should prevent access, but keep client-side as backup
  useEffect(() => {
    if (!authLoading && (!currentUser || !currentUser.isAdmin)) {
      toast.error('You do not have permission to access this page');
      router.push('/');
    }
  }, [currentUser, authLoading, router]);

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

        {/* Add more admin tools here */}
      </div>
    </AdminPageWrapper>
  );
}

// Server-side authentication check - requires admin privileges
export const getServerSideProps = withServerSideAdmin(true); 