import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import LoginModal from './LoginModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { AiOutlineArrowLeft, AiOutlineCalendar, AiOutlineCompass, AiOutlineDesktop, AiOutlineVideoCamera } from 'react-icons/ai';
import styles from '../styles/Header.module.css';
import Image from 'next/image';
import LoadingScreen from './LoadingScreen';
import DashboardHeader from './DashboardHeader';
import MobileMenu from './MobileMenu';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useModal } from '../contexts/ModalContext';


const Header = () => {
  const [isSticky, setIsSticky] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { user, logout } = useAuth();
  const navRef = useRef(null);
  const hamburgerRef = useRef(null);
  const router = useRouter();
  const { openLoginModal } = useModal();

  const showDashboardHeader = user && (
    router.pathname === '/dashboard' ||
    router.pathname === '/discover' ||
    router.pathname.startsWith('/profile/') ||
    router.pathname === '/avcomputers' ||
    router.pathname === '/shop' ||
    router.pathname === '/topusers' ||
    router.pathname === '/events'
  );

  const showGoBackButton = user && 
    router.pathname !== '/' && 
    router.pathname !== '/dashboard';

  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    let lastScroll = 0;
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setIsSticky(currentScroll > lastScroll && currentScroll > 0);
      lastScroll = currentScroll;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleLogout = useCallback(async (e) => {
    e.preventDefault();
    setIsTransitioning(true);
    try {
      await logout();
      closeMenu();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsTransitioning(false);
    }
  }, [logout]);

  useEffect(() => {
    if (!isMobile) {
      setIsMenuOpen(false);
    }
  }, [isMobile]);

  return (
    <>
      <div className={styles.headerWrapper}>
        <header className={`${styles.header} ${isSticky ? styles.sticky : ''}`}>
          <div className={styles.logoContainer}>
            {isMobile && showGoBackButton && (
              <button 
                className={styles.goBackButton} 
                onClick={() => router.back()}
              >
                <AiOutlineArrowLeft size={30} />
              </button>
            )}

            <Link href="/" passHref legacyBehavior>
              <a>
                {isMobile ? (
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
                ) : (
                  <h1 className={styles.logo}>
                    <span className={styles.merrouch}>Merrouch</span>{' '}
                    <span className={styles.gaming}>Gaming</span>
                  </h1>
                )}
              </a>
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

          {!isMobile && (
            <nav ref={navRef} className={styles.nav}>
              {showGoBackButton && (
                <button className={styles.goBackButton} onClick={() => router.back()}>
                  <AiOutlineArrowLeft size={30} />
                </button>
              )}

              {user ? (
                <>
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
                  <button className={styles.loginButton} onClick={openLoginModal}>
                    Login
                  </button>
                </>
              )}
            </nav>
          )}
        </header>
      </div>

      {isMobile && (
        <MobileMenu isOpen={isMenuOpen}>
          <nav ref={navRef} className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}>
            {/* Navigation Links for Mobile - Only show when user is authenticated */}
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
                  className={styles.loginButton}
                  onClick={() => {
                    openLoginModal();
                    closeMenu();
                  }}
                >
                  Login
                </button>
              </>
            )}
          </nav>
        </MobileMenu>
      )}
    </>
  );
};

export default Header;