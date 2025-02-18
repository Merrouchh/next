import 'intersection-observer';
import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { Inter, Orbitron } from 'next/font/google';
import { useEffect, useState, StrictMode } from 'react';
import { useRouter } from 'next/router';
import { VideoProvider } from '../contexts/VideoContext';
import { Toaster } from 'react-hot-toast';
import { DefaultSeo } from 'next-seo';
import { defaultSEO } from '../utils/seo-config';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
});

// Add error handler for lock failures
const handleLockError = (error) => {
  if (error.message?.includes('LockManager lock') || error.isAcquireTimeout) {
    // Silently handle lock errors
    console.debug('Auth lock already acquired, continuing...');
    return;
  }
  // Rethrow other errors
  throw error;
};

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Add global error handler for lock errors
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('LockManager lock')) {
        event.preventDefault(); // Prevent the error from being logged
        handleLockError(event.reason);
      }
    });

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const handleScrollTop = () => {
      try {
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
        
        document.documentElement.scrollTo({
          top: 0,
          behavior: 'instant'
        });
        
        document.body.scrollTo({
          top: 0,
          behavior: 'instant'
        });

        window.scrollY = 0;
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch (e) {
        window.scrollTo(0, 0);
      }
    };

    handleScrollTop();

    const handleRouteChange = () => {
      setTimeout(handleScrollTop, 100);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, mounted]);

  if (process.env.NEXT_PUBLIC_ENABLE_STRICT_MODE === 'true') {
    return (
      <StrictMode>
        <ErrorBoundary>
          <div suppressHydrationWarning>
            <DefaultSeo {...defaultSEO} />
            <AuthProvider onError={handleLockError}>
              <VideoProvider>
                <Toaster 
                  position="bottom-center"
                  toastOptions={{
                    style: {
                      background: '#333',
                      color: '#fff',
                      border: '1px solid #2a2a2a',
                    },
                    success: {
                      duration: 2000,
                      iconTheme: {
                        primary: '#FFD700',
                        secondary: '#000',
                      },
                    },
                    error: {
                      duration: 3000,
                      iconTheme: {
                        primary: '#ff4b4b',
                        secondary: '#fff',
                      },
                    },
                  }}
                />
                <Layout>
                  <main className={`${inter.variable} ${orbitron.variable}`} suppressHydrationWarning>
                    <Component {...pageProps} />
                  </main>
                </Layout>
              </VideoProvider>
            </AuthProvider>
          </div>
        </ErrorBoundary>
      </StrictMode>
    );
  }

  return (
    <>
      <DefaultSeo {...defaultSEO} />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;