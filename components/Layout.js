import Footer from './Footer';
import Header from './Header';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import LoadingScreen from './LoadingScreen';

const Layout = ({ children }) => {
  const router = useRouter();
  const { loading } = useAuth();
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Pages where header/footer should be hidden
  const hideHeaderPaths = ['/login', '/register'];
  const hideFooterPaths = ['/avcomputers', '/dashboard', '/voicechat', '/upload', '/register'];

  // Handle route changes
  useEffect(() => {
    const handleStart = () => setIsTransitioning(true);
    const handleComplete = () => setIsTransitioning(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  if (loading || isTransitioning) {
    return <LoadingScreen />;
  }

  return (
    <div className={`layout ${isTransitioning ? 'transitioning' : ''}`}>
      {!hideHeaderPaths.includes(router.pathname) && <Header />}
      <main className="main-content">
        {children}
      </main>
      {!hideFooterPaths.includes(router.pathname) && <Footer />}
    </div>
  );
};

export default Layout;
