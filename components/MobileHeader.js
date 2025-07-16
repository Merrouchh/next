import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { AiOutlineCalendar, AiOutlineCompass, AiOutlineDesktop, AiOutlineVideoCamera, AiOutlineDashboard, AiOutlineStar, AiOutlineShop } from 'react-icons/ai';
import styles from '../styles/MobileHeader.module.css';
import Image from 'next/image';
import MobileMenu from './MobileMenu';
import { useModal } from '../contexts/ModalContext';

const MobileHeader = () => {
  const [isSticky, setIsSticky] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navRef = useRef(null);
  const hamburgerRef = useRef(null);
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && 
          !navRef.current.contains(event.target) && 
          hamburgerRef.current && 
          !hamburgerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
      closeMenu();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className={`${styles.headerWrapper} mobileOnly`}>
      <nav className={`${styles.header} ${isSticky ? styles.sticky : ''}`}>
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/logomobile.png"
              alt="Merrouch Gaming"
              width={150}
              height={75}
              priority={true}
              loading="eager"
              className={styles.mobileLogo}
              sizes="(max-width: 768px) 150px, 110px"
            />
          </Link>
        </div>

        <div
          ref={hamburgerRef}
          className={`${styles.hamburger} ${isMenuOpen ? styles.open : ''}`}
          onClick={toggleMenu}
        >
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
        </div>
      </nav>

      <MobileMenu isOpen={isMenuOpen}>
        <div ref={navRef} className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}>
          {user && (
            <div className={styles.mobileNavLinks}>
              <button
                onClick={() => {
                  router.push('/discover');
                  closeMenu();
                }}
                className={`${styles.navButton} ${router.pathname === '/discover' ? styles.active : ''}`}
              >
                <span className={styles.icon}><AiOutlineCompass size={20} /></span>
                <span className={styles.label}>Discover</span>
              </button>
              
              <button
                onClick={() => {
                  router.push('/avcomputers');
                  closeMenu();
                }}
                className={`${styles.navButton} ${router.pathname === '/avcomputers' ? styles.active : ''}`}
              >
                <span className={styles.icon}><AiOutlineDesktop size={20} /></span>
                <span className={styles.label}>Computers</span>
              </button>
              
              <button
                onClick={() => {
                  router.push('/events');
                  closeMenu();
                }}
                className={`${styles.navButton} ${router.pathname === '/events' ? styles.active : ''}`}
              >
                <span className={styles.icon}><AiOutlineCalendar size={20} /></span>
                <span className={styles.label}>Events</span>
              </button>
              
              <button
                onClick={() => {
                  router.push(`/profile/${user?.username}`);
                  closeMenu();
                }}
                className={`${styles.navButton} ${router.pathname.startsWith('/profile/') ? styles.active : ''}`}
              >
                <span className={styles.icon}><AiOutlineVideoCamera size={20} /></span>
                <span className={styles.label}>Profile</span>
              </button>

              <button
                onClick={() => {
                  router.push('/awards');
                  closeMenu();
                }}
                className={`${styles.navButton} ${router.pathname === '/awards' ? styles.active : ''}`}
              >
                <span className={styles.icon}><AiOutlineStar size={20} /></span>
                <span className={styles.label}>Awards</span>
              </button>

              <button
                onClick={() => {
                  router.push('/shop');
                  closeMenu();
                }}
                className={`${styles.navButton} ${router.pathname === '/shop' ? styles.active : ''}`}
              >
                <span className={styles.icon}><AiOutlineShop size={20} /></span>
                <span className={styles.label}>Shop</span>
              </button>

              {user?.isAdmin && (
                <button
                  onClick={() => {
                    router.push('/admin');
                    closeMenu();
                  }}
                  className={`${styles.navButton} ${router.pathname === '/admin' ? styles.active : ''}`}
                >
                  <span className={styles.icon}><AiOutlineDashboard size={20} /></span>
                  <span className={styles.label}>Admin</span>
                </button>
              )}
            </div>
          )}

          {user ? (
            <>
              <div className={styles.usernameBox}>
                {user?.username}
                {user?.isAdmin && <span className={styles.adminBadge}>Admin</span>}
              </div>
              <button className={styles.logoutButton} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button 
                className={styles.eventsButton} 
                onClick={() => {
                  router.push('/events');
                  closeMenu();
                }}
              >
                <AiOutlineCalendar className={styles.buttonIcon} />
                Events
              </button>
              <button 
                className={styles.clipsButton} 
                onClick={() => {
                  router.push('/discover');
                  closeMenu();
                }}
              >
                <AiOutlineVideoCamera className={styles.buttonIcon} />
                Public Clips
              </button>
              <button
                className={`${styles.loginButton} ${styles.yellowButton}`}
                onClick={() => {
                  openLoginModal();
                  closeMenu();
                }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </MobileMenu>
    </div>
  );
};

export default MobileHeader; 