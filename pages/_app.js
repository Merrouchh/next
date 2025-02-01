import { useEffect } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';

// Disable console in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
          console.error('PWA: Service Worker registration failed:', error);
        });
      });
    }
  }, []);

  return (
    <ErrorBoundary>
        <AuthProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp;