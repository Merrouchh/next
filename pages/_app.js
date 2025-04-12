import 'intersection-observer';
import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { Inter, Orbitron } from 'next/font/google';
import { useEffect, useState, StrictMode } from 'react';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import { DefaultSeo } from 'next-seo';
import { defaultSEO } from '../utils/seo-config';
import DynamicMeta from '../components/DynamicMeta';
import { ModalProvider } from '../contexts/ModalContext';

// Disable error overlay in development
if (process.env.NODE_ENV === 'development') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('AuthApiError') || 
       args[0].includes('Invalid login credentials') ||
       args[0].includes('Current password is incorrect') ||
       args[0].includes('verification code') ||
       args[0].includes('Invalid verification code'))
    ) {
      // Suppress specific errors from the console
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Override Error overlay
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      if (
        event.error?.name === 'AuthApiError' || 
        event.error?.message?.includes('Invalid login credentials') ||
        event.error?.message?.includes('Current password is incorrect') ||
        event.error?.message?.includes('verification code') ||
        event.error?.message?.includes('Invalid verification code')
      ) {
        event.preventDefault();
        return false;
      }
    }, true);
  }
}

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
});

// Add error handler for lock failures and auth errors
const handleGlobalError = (error) => {
  if (error.message?.includes('LockManager lock') || error.isAcquireTimeout) {
    // Silently handle lock errors
    console.debug('Auth lock already acquired, continuing...');
    return;
  }
  
  // Handle Supabase auth errors
  if (error.name === 'AuthApiError' || 
      error.message?.includes('Invalid login credentials') ||
      error.message?.includes('verification code') ||
      error.message?.includes('Invalid verification code')) {
    // Log but don't show in Next.js error overlay
    console.debug('Auth error handled:', error.message);
    return;
  }
  
  // Rethrow other errors
  throw error;
};

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Add global error handler for lock errors and auth errors
    const handleUnhandledRejection = (event) => {
      const error = event.reason;
      
      // Check for auth-related errors
      if (
        error?.name === 'AuthApiError' || 
        error?.message?.includes('Invalid login credentials') ||
        error?.message?.includes('LockManager lock') ||
        error?.message?.includes('Current password is incorrect') ||
        error?.message?.includes('verification code') ||
        error?.message?.includes('Invalid verification code') ||
        error?.isAcquireTimeout
      ) {
        // Prevent the error from propagating
        event.preventDefault();
        event.stopPropagation();
        
        // Log for debugging but suppress the overlay
        console.debug('Auth error suppressed:', error.message || 'Unknown auth error');
        
        // Return false to stop error propagation
        return false;
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

    setMounted(true);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    };
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

  // Determine if it's a public page
  const isPublicPage = ['/'].includes(router.pathname);

  // Add safety check for metaData
  const safeMetaData = pageProps?.metaData || {
    title: defaultSEO.defaultTitle,
    description: defaultSEO.description
  };

  if (process.env.NEXT_PUBLIC_ENABLE_STRICT_MODE === 'true') {
    return (
      <StrictMode>
        <ErrorBoundary>
          <div suppressHydrationWarning>
            {/* Base SEO - lowest priority */}
            <DefaultSeo {...defaultSEO} />
            
            {/* Only include DynamicMeta when the page doesn't provide its own specific metadata */}
            {!pageProps.metaData?.skipMeta && !router.pathname.startsWith('/events/') && (
              <DynamicMeta {...safeMetaData} />
            )}
            
            <AuthProvider onError={handleGlobalError}>
              <ModalProvider>
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
              </ModalProvider>
            </AuthProvider>
          </div>
        </ErrorBoundary>
      </StrictMode>
    );
  }

  return (
    <StrictMode>
      <ErrorBoundary>
        <div suppressHydrationWarning>
          {/* Base SEO - lowest priority */}
          <DefaultSeo {...defaultSEO} />
          
          {/* Only include DynamicMeta when the page doesn't provide its own specific metadata */}
          {!pageProps.metaData?.skipMeta && !router.pathname.startsWith('/events/') && (
            <DynamicMeta {...safeMetaData} />
          )}
          
          <AuthProvider onError={handleGlobalError}>
            <ModalProvider>
              <Toaster />
              <Layout>
                <main className={`${inter.variable} ${orbitron.variable}`}>
                  <Component {...pageProps} />
                </main>
              </Layout>
            </ModalProvider>
          </AuthProvider>
        </div>
      </ErrorBoundary>
    </StrictMode>
  );
}

export default MyApp;