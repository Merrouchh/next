import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { AiOutlineCalendar, AiOutlineVideoCamera, AiOutlineDashboard, AiOutlineTrophy, AiOutlineShop } from 'react-icons/ai';
import { FaUsers } from 'react-icons/fa';
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
    const timeoutRef = scrollTimeoutRef.current;
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutRef) {
        clearTimeout(timeoutRef);
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
        <div className={`${styles.logoContainer} ${styles.logoContainerHome}`}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/logomobile.png"
              alt="Merrouch Gaming"
              width={200}
              height={50}
              className={styles.desktopLogo}
              priority
            />
          </Link>
        </div>

        <div className={`${styles.nav} ${user ? styles.navLoggedIn : styles.navCentered}`}>
          {user ? (
            <>
              <div className={styles.navLeft}>
                {user?.isAdmin && (
                  <button 
                    className={styles.adminButton}
                    onClick={() => router.push('/admin')}
                  >
                    <AiOutlineDashboard className={styles.buttonIcon} />
                    Admin
                  </button>
                )}
                {user?.isStaff && (
                  <button 
                    className={styles.adminButton}
                    onClick={() => router.push('/admin/queue')}
                  >
                    <FaUsers className={styles.buttonIcon} />
                    Queue
                  </button>
                )}
                <span className={styles.usernameBox}>
                  {user?.username}
                </span>
              </div>
              <button className={styles.logoutButton} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className={`${styles.loginButton} ${styles.yellowButton}`} onClick={openLoginModal}>
                Login
              </button>
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
                Users Highlight Clips
              </button>
              <button 
                className={styles.topUsersButton} 
                onClick={() => router.push('/topusers')}
              >
                <AiOutlineTrophy className={styles.buttonIcon} />
                Top Users
              </button>
              <button 
                className={styles.shopButton} 
                onClick={() => router.push('/shop')}
              >
                <AiOutlineShop className={styles.buttonIcon} />
                Prices
              </button>
            </>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Header;