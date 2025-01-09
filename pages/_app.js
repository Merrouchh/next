import { useEffect } from 'react';
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

  // Add scroll to top on route change
  useEffect(() => {
    const handleRouteChange = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

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