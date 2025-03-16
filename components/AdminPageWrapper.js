import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';

/**
 * Wrapper component for admin-only pages
 * Checks if the user is an admin and redirects to home if not
 */
export default function AdminPageWrapper({ children }) {
  const { user, isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If authentication is complete and user is not an admin, redirect to home
    if (!loading && (!isLoggedIn || !user?.isAdmin)) {
      router.replace('/');
    }
  }, [user, isLoggedIn, loading, router]);

  // Show loading screen while checking authentication
  if (loading || !isLoggedIn || !user?.isAdmin) {
    return <LoadingScreen message="Checking admin access..." />;
  }

  // Render children if user is an admin
  return <>{children}</>;
} 