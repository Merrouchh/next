import 'intersection-observer';
import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { Inter, Orbitron, Rajdhani, Zen_Dots } from 'next/font/google';
import { useEffect, useState, StrictMode } from 'react';
import { useRouter } from 'next/router';
import ClientOnlyToaster from '../components/ClientOnlyToaster';
import { DefaultSeo } from 'next-seo';
import { defaultSEO } from '../utils/seo-config';
import { ModalProvider } from '../contexts/ModalContext';
import Head from 'next/head';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-rajdhani',
});

const zenDots = Zen_Dots({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-zen-dots',
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

    const handleRouteChange = () => {
      setTimeout(() => {
        handleScrollTop();
      }, 100);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, mounted]);

  const getLayout = Component.getLayout || ((page) => <Layout>{page}</Layout>);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#000000'
      }}>
        <div style={{ color: '#FFD700' }}>Loading...</div>
      </div>
    );
  }

  const isAuthPage = router.pathname.startsWith('/auth/');
  const isPublicPage = ['/', '/shop', '/events', '/topusers', '/discover'].includes(router.pathname) || 
                      router.pathname.startsWith('/events/') || 
                      router.pathname.startsWith('/profile/');

  if (isAuthPage) {
    return (
      <StrictMode>
        <ErrorBoundary>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
            <meta name="theme-color" content="#FFD700" />
          </Head>
          <DefaultSeo {...defaultSEO} />
          <main className={`${inter.variable} ${orbitron.variable} ${rajdhani.variable} ${zenDots.variable}`} suppressHydrationWarning>
            <AuthProvider>
              <ModalProvider>
                <Component {...pageProps} />
                <ClientOnlyToaster />
              </ModalProvider>
            </AuthProvider>
          </main>
        </ErrorBoundary>
      </StrictMode>
    );
  }

  return (
    <StrictMode>
      <ErrorBoundary>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          <meta name="theme-color" content="#FFD700" />
        </Head>
        {/* Disable DefaultSeo to prevent conflicts with DynamicMeta */}
        {/* {!pageProps.metaData && <DefaultSeo {...defaultSEO} />} */}
        <main className={`${inter.variable} ${orbitron.variable} ${rajdhani.variable} ${zenDots.variable}`}>
          <AuthProvider>
            <ModalProvider>
              {getLayout(<Component {...pageProps} />)}
              <ClientOnlyToaster />
            </ModalProvider>
          </AuthProvider>
        </main>
      </ErrorBoundary>
    </StrictMode>
  );
}

export default MyApp;