import Footer from './Footer';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import React from 'react';
import styles from '../styles/Layout.module.css';
import LoginModal from './LoginModal';
import { useModal } from '../contexts/ModalContext';
import { isAuthPage } from '../utils/routeConfig';
import { MdFileUpload } from 'react-icons/md';

const Layout = ({ children }) => {
  const router = useRouter();
  const { initialized, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const isHomePage = router.pathname === '/';
  const { isLoginModalOpen, closeLoginModal } = useModal();
  const isVerificationPage = isAuthPage(router.pathname);
  const [isMobile, setIsMobile] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [rippleStyle, setRippleStyle] = useState({});
  const uploadButtonRef = useRef(null);

  const shouldHideFooter = useCallback(() => {
    if (!router?.pathname) return true;
    
    const hideFooterPaths = [
      '/avcomputers', 
      '/dashboard', 
      '/shop', 
      '/upload',
      '/discover',
      '/topusers',
      '/events',
      '/awards'
    ];

    if (isVerificationPage) return true;
    
    const isProfilePage = router.pathname.startsWith('/profile/');
    const isEventDetailPage = router.pathname.startsWith('/events/') && router.pathname !== '/events';
    return hideFooterPaths.includes(router.pathname) || isProfilePage || isEventDetailPage;
  }, [router?.pathname, isVerificationPage]);

  // Initialize component
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  if (!mounted || !initialized) {
    return (
      <>
        <div className={styles.layoutWrapper}>
          <div>
            {/* Placeholder for empty initial state */}
          </div>
        </div>
        <div id="modal-root" className={styles.modalRoot}></div>
      </>
    );
  }

  // For auth pages like verification, use a cleaner layout
  if (isVerificationPage) {
    return (
      <>
        <div className={`${styles.layoutWrapper} ${styles.authLayout}`}>
          <div className={styles.layoutContent}>
            <main className={styles.mainContent}>
              {children}
            </main>
          </div>
        </div>
        <div id="modal-root" className={styles.modalRoot}></div>
      </>
    );
  }

  // Navigate to upload page with ripple effect
  const handleUploadClick = (e) => {
    // Create ripple effect
    const button = uploadButtonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      setRippleStyle({
        width: `${size}px`,
        height: `${size}px`,
        left: `${x}px`,
        top: `${y}px`
      });
      
      setRipple(true);
      
      // Navigate after ripple animation
      setTimeout(() => {
        router.push('/upload');
        setTimeout(() => setRipple(false), 300);
      }, 300);
    } else {
      router.push('/upload');
    }
  };

  return (
    <>
      <div className={styles.layoutWrapper}>
        <div className={styles.layoutContent}>
          <main className={styles.mainContent}>
            {children}
          </main>
          {!shouldHideFooter() && (
            <footer className={styles.stickyFooter}>
              <Footer />
            </footer>
          )}
        </div>
      </div>
      <div id="modal-root" className={styles.modalRoot}>
        <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      </div>
      
      {/* Floating upload button for desktop logged-in users (hidden on upload page) */}
      {user && !isMobile && router.pathname !== '/upload' && (
        <button 
          ref={uploadButtonRef}
          className={styles.floatingUploadButton}
          onClick={handleUploadClick}
          aria-label="Upload new content"
          title="Upload new content"
        >
          <MdFileUpload />
          <span className={styles.uploadButtonText}>Upload</span>
          {ripple && <span className={styles.ripple} style={rippleStyle} />}
        </button>
      )}
    </>
  );
};

export default Layout;
