import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header'; // Import Header component
import { supabase } from '../contexts/AuthContext'; // Import supabase client
import styles from './Admin.module.css';

const Admin = () => {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    if (!loading && (!isLoggedIn || !isAdmin)) {
      router.push('/'); // Redirect to home if not logged in or not an admin
    }
  }, [isLoggedIn, isAdmin, loading, router]);

  useEffect(() => {
    const fetchUserCount = async () => {
      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact' });
      if (!error) {
        setUserCount(count);
      } else {
        console.error('Error fetching user count:', error);
      }
    };

    if (isLoggedIn && isAdmin) {
      fetchUserCount();
    }
  }, [isLoggedIn, isAdmin]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Header /> {/* Include the header component */}
      <div className={styles.adminContainer}>
        <h1>Admin Dashboard</h1>
        <p>Welcome, Admin! Here you can manage the application.</p>
        <div className={styles.cardContainer}>
          <div className={styles.card}>
            <h2>Total Users</h2>
            <p>{userCount}</p>
          </div>
          {/* Add more admin-specific cards here */}
        </div>
      </div>
    </>
  );
};

export default Admin;
