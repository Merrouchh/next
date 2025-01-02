import { useEffect, useState } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { createClient } from '../utils/supabase/client';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const protectedRoutes = ['/dashboard', '/avcomputers', '/chat', '/shop'];
        
        if (session) {
          if (protectedRoutes.includes(router.pathname)) {
            setIsLoading(false);
            return; // Stay on current route
          }
        } else if (router.pathname === '/topusers') {
          setIsLoading(false);
          return; // Allow access to topusers page
        } else if (!protectedRoutes.includes(router.pathname)) {
          setIsLoading(false);
          return; // Allow access to non-protected routes
        } else {
          router.push('/'); // Redirect to home if not authenticated
        }
        
        // Handle sign out case
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' && router.pathname !== '/') {
            router.push('/');
          }
        });

        setIsLoading(false);
        return () => subscription?.unsubscribe();
      } catch (error) {
        console.error('Session check error:', error);
        setIsLoading(false);
      }
    };

    checkSession();
  }, [router, supabase.auth]);

  useEffect(() => {
    // Ensure loading state is reset if no session is found
    if (isLoading) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setIsLoading(false);
          if (router.pathname !== '/' && !['/topusers'].includes(router.pathname)) {
            router.push('/');
          }
        } else {
          setIsLoading(false);
        }
      }).catch(() => {
        setIsLoading(false);
        if (router.pathname !== '/' && !['/topusers'].includes(router.pathname)) {
          router.push('/');
        }
      });
    }
  }, [isLoading, supabase, router]);

  useEffect(() => {
    // Handle case where user manually deletes cookies or local storage
    const handleStorageChange = () => {
      const authCookie = document.cookie.split(';').some((item) => item.trim().startsWith('auth='));
      const storageToken = localStorage.getItem('supabase.auth.token');
      if (!authCookie || !storageToken) {
        router.push('/');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [router]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Layout>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </Head>
          <Component {...pageProps} />
        </Layout>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp;