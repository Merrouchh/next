import Footer from './Footer';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useState, useCallback, useRef } from 'react';
import React from 'react';
import styles from '../styles/Layout.module.css';
import LoginModal from './LoginModal';
import NotificationBubble from './NotificationBubble';
// import CookieConsent from './CookieConsent';
import { useModal } from '../contexts/ModalContext';
import { isAuthPage, isAdminPage } from '../utils/routeConfig';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { MdFileUpload } from 'react-icons/md';

const Layout = ({ children }) => {
  const router = useRouter();
  const { initialized, user } = useAuth();
  // const isHomePage = router.pathname === '/'; // Removed unused variable
  const { isLoginModalOpen, closeLoginModal } = useModal();
  const isVerificationPage = isAuthPage(router.pathname);
  const isMobile = useMediaQuery('(max-width: 768px)');
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
    
    // Hide footer for all admin pages
    if (isAdminPage(router.pathname)) return true;
    
    const isProfilePage = router.pathname.startsWith('/profile/');
    const isEventDetailPage = router.pathname.startsWith('/events/') && router.pathname !== '/events';
    return hideFooterPaths.includes(router.pathname) || isProfilePage || isEventDetailPage;
  }, [router?.pathname, isVerificationPage]);

  // Handle conditional rendering based on state
  if (!initialized) {
    return null;
  }

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
      // Use requestAnimationFrame to avoid forced reflow
      requestAnimationFrame(() => {
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
      });
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
      
      {/* Cookie Consent Banner (disabled for now) */}
      {/* <CookieConsent /> */}
      
      {/* Floating upload button for desktop logged-in users (hidden on upload page) */}
      {user && !isMobile && router.pathname !== '/upload' && (
        <button 
          ref={uploadButtonRef}
          id="floating-upload-button"
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

      {/* Notification Bubble - Show for all logged-in users on all pages */}
      {user && <NotificationBubble />}
    </>
  );
};

export default Layout;
