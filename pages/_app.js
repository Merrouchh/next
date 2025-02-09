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
      // Try multiple scroll methods for better cross-browser/device support
      try {
        // For modern browsers
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
        
        // Fallback for iOS Safari
        document.documentElement.scrollTo({
          top: 0,
          behavior: 'instant'
        });
        
        // Additional fallback
        document.body.scrollTo({
          top: 0,
          behavior: 'instant'
        });

        // Ultimate fallback
        window.scrollY = 0;
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch (e) {
        // If smooth scroll fails, use immediate scroll
        window.scrollTo(0, 0);
      }
    };

    // Handle initial page load
    handleScrollTop();

    // Handle route changes
    const handleRouteChange = () => {
      // Small delay to ensure content is rendered
      setTimeout(handleScrollTop, 100);
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
          <main className={`${inter.variable} ${orbitron.variable}`}>
            <Component {...pageProps} />
          </main>
        </Layout>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp;