import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import styles from '../../styles/AdminEvents.module.css';

export default function SetupStorage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, supabase } = useAuth();

  // Handle creating the storage bucket
  const handleCreateBucket = async () => {
    if (!confirm('Are you sure you want to create/update the images storage bucket?')) return;
    
    setLoading(true);
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const response = await fetch('/api/admin/create-storage-bucket', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to create storage bucket');
      }
      
      toast.success('Storage bucket setup successfully!');
    } catch (error) {
      console.error('Error setting up storage bucket:', error);
      toast.error(`Failed to set up storage bucket: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // If not authenticated or not admin, don't render anything
  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Setup Storage | Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for setting up storage" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Setup Storage
          </h1>
        </div>

        <div className={styles.content}>
          <div className={styles.setupCard}>
            <h2>Storage Bucket Setup</h2>
            <p>
              This page allows you to create and configure the storage bucket needed for image uploads.
              Use this if you're experiencing issues with image uploads due to missing storage buckets or permissions.
            </p>
            <p>
              <strong>What this does:</strong>
            </p>
            <ul>
              <li>Creates the 'images' storage bucket if it doesn't exist</li>
              <li>Sets the bucket to be publicly readable</li>
              <li>Configures proper permissions for admin users to upload images</li>
            </ul>
            <p>
              <strong>Note:</strong> This requires the SUPABASE_SERVICE_ROLE_KEY to be set in your environment variables.
            </p>
            <div className={styles.actionButtons}>
              <button 
                className={styles.createButton}
                onClick={handleCreateBucket}
                disabled={loading}
              >
                {loading ? 'Setting up...' : 'Setup Storage Bucket'}
              </button>
              <button 
                className={styles.cancelButton}
                onClick={() => router.push('/admin/events')}
                disabled={loading}
              >
                Back to Events
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedPageWrapper>
  );
} 