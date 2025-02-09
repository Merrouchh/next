import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { Inter, Orbitron } from 'next/font/google';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
});

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Function to handle scroll to top
    const handleScrollTop = () => {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    };

    // Handle initial page load
    handleScrollTop();

    // Handle route changes
    router.events.on('routeChangeComplete', handleScrollTop);

    // Cleanup
    return () => {
      router.events.off('routeChangeComplete', handleScrollTop);
    };
  }, [router.events]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Layout>
          <main className={`${inter.variable} ${orbitron.variable}`}>
            <Component {...pageProps} />
          </main>
        </Layout>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp;