import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { AiOutlineCalendar, AiOutlineVideoCamera, AiOutlineDashboard } from 'react-icons/ai';
import styles from '../styles/DesktopHeader.module.css';
import { useModal } from '../contexts/ModalContext';

const Header = () => {
  const [isSticky, setIsSticky] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const { openLoginModal } = useModal();
  const scrollTimeoutRef = useRef(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      // Throttle scroll events to prevent excessive updates
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        
        requestAnimationFrame(() => {
          const currentScroll = window.scrollY;
          const shouldBeSticky = currentScroll > 0;
          
          if (shouldBeSticky !== isSticky) {
            setIsSticky(shouldBeSticky);
          }
          
          isScrollingRef.current = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isSticky]);

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className={`${styles.headerWrapper} desktopOnly`}>
      <nav className={`${styles.header} ${isSticky ? styles.sticky : ''}`}>
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logoLink}>
            <h1 className={styles.logo}>
              <span className={styles.merrouch}>Merrouch</span>{' '}
              <span className={styles.gaming}>Gaming</span>
            </h1>
          </Link>
        </div>

        <div className={styles.nav}>
          {user ? (
            <>
              {user?.isAdmin && (
                <button 
                  className={styles.adminButton}
                  onClick={() => router.push('/admin')}
                >
                  <AiOutlineDashboard className={styles.buttonIcon} />
                  Admin
                </button>
              )}
              <span className={styles.usernameBox}>
                {user?.username}
                {user?.isAdmin && <span className={styles.adminBadge}>Admin</span>}
              </span>
              <button className={styles.logoutButton} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button 
                className={styles.eventsButton} 
                onClick={() => router.push('/events')}
              >
                <AiOutlineCalendar className={styles.buttonIcon} />
                Events
              </button>
              <button 
                className={styles.clipsButton} 
                onClick={() => router.push('/discover')}
              >
                <AiOutlineVideoCamera className={styles.buttonIcon} />
                Public Clips
              </button>
              <button className={`${styles.loginButton} ${styles.yellowButton}`} onClick={openLoginModal}>
                Login
              </button>
            </>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Header;