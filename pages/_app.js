import { useEffect } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { DefaultSeo } from 'next-seo';

// Disable console in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    let registration = null;

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', async () => {
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
        } catch (error) {
          console.error('PWA: Service Worker registration failed:', error);
        }
      });
    }

    return () => {
      if (registration) {
        registration.unregister();
      }
    };
  }, []);

  return (
    <>
      <DefaultSeo
        defaultTitle="Merrouch Gaming"
        titleTemplate="%s | Merrouch Gaming"
      />
      <ErrorBoundary>
        <AuthProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </AuthProvider>
      </ErrorBoundary>
    </>
  );
}

export default MyApp;