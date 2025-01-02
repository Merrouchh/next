import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import LoginModal from './LoginModal'; // Import LoginModal component
import { useAuth } from '../contexts/AuthContext'; // Import useAuth hook
import { useRouter } from 'next/router'; // Import useRouter for navigation
import { AiOutlineArrowLeft } from 'react-icons/ai'; // Icon for the go back button
import styles from '../styles/Header.module.css'; // Import styles
import Image from 'next/image'; // Import Next.js Image component

const Header = () => {
  const [isSticky, setIsSticky] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { isLoggedIn, logout, user, loading } = useAuth(); // Using auth context
  const navRef = useRef(null); // Ref for the navigation menu
  const hamburgerRef = useRef(null); // Ref for the hamburger button
  const router = useRouter(); // Access the router to check the current page

  useEffect(() => {
    const handleScroll = () => setIsSticky(window.scrollY > 0);
    const handleResize = () => setIsMobile(window.innerWidth <= 768);

    // Close menu if resizing to desktop view
    if (!isMobile) setIsMenuOpen(false);

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    handleResize(); // Initial check for mobile view
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  // Close menu on clicking outside, but allow clicks on the hamburger button
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        navRef.current &&
        !navRef.current.contains(event.target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(event.target)
      ) {
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


  const toggleMenu = () => setIsMenuOpen((prevState) => !prevState);
  const closeMenu = () => setIsMenuOpen(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Check if Go Back button should be visible - Add dashboard check
  const showGoBackButton = isLoggedIn && router.pathname !== '/' && router.pathname !== '/dashboard';

  // Go back function
  const goBack = () => {
    router.back(); // Navigate to the previous page
  };

  // Determine if the current page is Top Users
  const isTopUsersPage = router.pathname === '/topusers';

  const handleLogout = async (e) => {
    e.preventDefault();
    setIsTransitioning(true);
    try {
      const success = await logout();
      if (success) {
        // Clear any local storage or state
        localStorage.clear();
        // Force reload to clear any stale state
        router.push('/').then(() => router.reload());
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  // Handle navigation with loading state
  const handleNavigation = async (path) => {
    setIsTransitioning(true);
    try {
      await router.push(path);
    } finally {
      setIsTransitioning(false);
      setIsMenuOpen(false);
    }
  };

  if (loading || isTransitioning) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <header className={`${styles.header} ${isSticky ? styles.sticky : ''} ${user?.isAdmin ? styles.adminHeader : ''}`}>
        {/* Logo and Hamburger Menu inside a container */}
        <div className={styles.logoContainer}>
          {/* Go Back Button in Header for Mobile - Add dashboard check */}
          {isMobile && showGoBackButton && (
            <button className={styles.goBackButton} onClick={goBack}>
              <AiOutlineArrowLeft size={30} /> {/* Icon for the button */}
            </button>
          )}

          {/* Logo */}
          {isMobile ? (
            <Link href="/" passHref legacyBehavior>
              <a>
                <Image
                  src="/logomobile.png"
                  alt="Merrouch Gaming Logo"
                  width={150}
                  height={50}
                  className={styles.mobileLogo}
                  priority
                />
              </a>
            </Link>
          ) : (
            <Link href="/" passHref legacyBehavior>
              <a className={styles.noUnderline}>
                <h1 className={styles.logo}>
                  <span className={styles.merrouch}>Merrouch</span>{' '}
                  <span className={styles.gaming}>Gaming</span>
                </h1>
              </a>
            </Link>
          )}
        </div>

        {/* Hamburger Menu for Mobile */}
        <div
          ref={hamburgerRef}
          className={styles.hamburger}
          onClick={toggleMenu}
        >
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
        </div>

        {/* Navigation */}
        <nav
          ref={navRef}
          className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}
        >
          {/* Desktop Go Back button - Add dashboard check */}
          {!isMobile && showGoBackButton && (
            <button className={styles.goBackButton} onClick={goBack}>
              <AiOutlineArrowLeft size={30} /> {/* Icon for the button */}
            </button>
          )}

          {isLoggedIn ? (
            <>
              <span className={styles.usernameBox}>
                {user?.username}
                {user?.isAdmin && <span className={styles.adminBadge}>Admin</span>}
              </span>
              {user?.isAdmin && (
                <>
                  <Link href="/admin" passHref legacyBehavior>
                    <button className={styles.adminButton} onClick={closeMenu}>
                      Admin
                    </button>
                  </Link>
                  <Link href="/sendNotification" passHref legacyBehavior>
                    <button className={styles.adminButton} onClick={closeMenu}>
                      Send Notification
                    </button>
                  </Link>
                </>
              )}
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
                openModal(); // Open the modal
                closeMenu(); // Close the navigation menu
              }}
            >
              Login
            </button>
          )}
          <Link href="/topusers" passHref legacyBehavior>
            <button
              className={`${styles.topUsersButton} ${
                isTopUsersPage ? styles.activeButton : ''
              }`}
              onClick={closeMenu}
            >
              Top Users
            </button>
          </Link>
        </nav>
      </header>

      {/* Login Modal */}
      {isModalOpen && <LoginModal isOpen={isModalOpen} onClose={closeModal} />}
    </>
  );
}

export default Header;