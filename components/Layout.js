import Footer from './Footer';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import LoadingScreen from './LoadingScreen';
import { VideoProvider } from '../context/VideoContext';
import styles from '@/styles/Layout.module.css';
import BusinessInfo from './BusinessInfo';
import FAQSchema from './FAQSchema';

const Layout = ({ children, title = 'Merrouch Gaming' }) => {
  const router = useRouter();
  const { loading } = useAuth();
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Pages where footer should be hidden
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
    <VideoProvider>
      <div className={`layout ${isTransitioning ? 'transitioning' : ''}`}>
        <main className="main-content">
          <BusinessInfo />
          <FAQSchema />
          {children}
        </main>
        {!hideFooterPaths.includes(router.pathname) && <Footer />}
      </div>
      <div id="modal-root"></div>
    </VideoProvider>
  );
};

export default Layout;
