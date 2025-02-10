import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { Inter, Orbitron } from 'next/font/google';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { VideoProvider } from '../contexts/VideoContext';
import { Toaster } from 'react-hot-toast';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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

  return (
    <ErrorBoundary>
      <div suppressHydrationWarning>
        <AuthProvider>
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
  );
}

export default MyApp;