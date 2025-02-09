import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import LoginModal from './LoginModal';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { AiOutlineArrowLeft } from 'react-icons/ai';
import styles from '../styles/Header.module.css';
import Image from 'next/image';
import LoadingScreen from './LoadingScreen';
import DashboardHeader from './DashboardHeader';


const Header = () => {
  const [isSticky, setIsSticky] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { isLoggedIn, logout, user, loading } = useAuth();
  const navRef = useRef(null);
  const hamburgerRef = useRef(null);
  const router = useRouter();

  const showDashboardHeader = isLoggedIn && (
    router.pathname === '/dashboard' ||
    router.pathname === '/discover' ||
    router.pathname.startsWith('/profile/') ||
    router.pathname === '/avcomputers' ||
    router.pathname === '/shop' ||
    router.pathname === '/topusers'
  );

  const showGoBackButton = isLoggedIn && 
    router.pathname !== '/' && 
    router.pathname !== '/dashboard';

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
    const handleResize = () => setIsMobile(window.innerWidth <= 768);

    if (!isMobile) setIsMenuOpen(false);

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

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

  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu = () => setIsMenuOpen(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleLogout = async (e) => {
    e.preventDefault();
    setIsTransitioning(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Handle UI feedback here if needed
    } finally {
      setIsTransitioning(false);
    }
  };

  if (loading || isTransitioning) {
    return <LoadingScreen message="Loading..." />;
  }

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
                    alt="Merrouch Gaming Logo"
                    width={150}
                    height={50}
                    className={styles.mobileLogo}
                    priority={router.pathname === '/'}
                    loading={router.pathname === '/' ? "eager" : "lazy"}
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAPUlEQVR4nGNgQIApU6b8////1atXDAwMv3//ZkACL1++ZGBg+P//PwMDw5s3b5B5DAwMv379YmBg+Pv3LzIPAFNVD4x+XW6ZAAAAAElFTkSuQmCC"
                    sizes="(max-width: 768px) 150px, 0px"
                    quality={75}
                    decoding="async"
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
            className={styles.hamburger}
            onClick={toggleMenu}
          >
            <div className={styles.bar}></div>
            <div className={styles.bar}></div>
            <div className={styles.bar}></div>
          </div>

          <nav
            ref={navRef}
            className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}
          >
            {!isMobile && showGoBackButton && (
              <button className={styles.goBackButton} onClick={() => router.back()}>
                <AiOutlineArrowLeft size={30} />
              </button>
            )}

            {isLoggedIn ? (
              <>
                <span className={styles.usernameBox}>
                  {user?.username}
                  {user?.isAdmin && <span className={styles.adminBadge}>Admin</span>}
                </span>
                <button
                  className={styles.logoutButton}
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                className={styles.loginButton}
                onClick={() => {
                  openModal();
                  closeMenu();
                }}
              >
                Login
              </button>
            )}
          </nav>
        </header>
      </div>

      {showDashboardHeader && <DashboardHeader />}
      {isModalOpen && <LoginModal isOpen={isModalOpen} onClose={closeModal} />}
    </>
  );
};

export default Header;