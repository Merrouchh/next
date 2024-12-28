import { AuthProvider } from "../contexts/AuthContext"; // Adjust the path accordingly
import '../styles/globals.css'; // Import the global styles
import '../pages/avcomputers.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Head from 'next/head'; // Import Head for meta tags
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  return (
    <>
      {/* Add the viewport meta tag */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui" />
      </Head>
      
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}

export default MyApp;
