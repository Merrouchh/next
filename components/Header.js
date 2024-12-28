import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import LoginModal from './LoginModal'; // Import LoginModal component
import { useAuth } from '../contexts/AuthContext'; // Import useAuth hook
import { useRouter } from 'next/router'; // Import useRouter for navigation
import { AiOutlineArrowLeft } from 'react-icons/ai'; // Icon for the go back button
import styles from './Header.module.css'; // Import styles

export default function Header() {
  const [isSticky, setIsSticky] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { isLoggedIn, logOut, username } = useAuth(); // Using auth context
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

  // Check if Go Back button should be visible
  const showGoBackButton = isLoggedIn && router.pathname !== '/';

  // Go back function
  const goBack = () => {
    router.back(); // Navigate to the previous page
  };

  // Determine if the current page is Top Users
  const isTopUsersPage = router.pathname === '/topusers';

  return (
    <>
      <header className={`${styles.header} ${isSticky ? styles.sticky : ''}`}>
        {/* Logo and Hamburger Menu inside a container */}
        <div className={styles.logoContainer}>
          {/* Go Back Button in Header for Mobile */}
          {isMobile && showGoBackButton && (
            <button className={styles.goBackButton} onClick={goBack}>
              <AiOutlineArrowLeft size={30} /> {/* Icon for the button */}
            </button>
          )}

          {/* Logo */}
          {isMobile ? (
            <Link href="/" passHref legacyBehavior>
              <a>
                <img
                  src="/logomobile.png"
                  alt="Merrouch Gaming Logo"
                  className={styles.mobileLogo}
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
          {!isMobile && showGoBackButton && (
            <button className={styles.goBackButton} onClick={goBack}>
              <AiOutlineArrowLeft size={30} /> {/* Icon for the button */}
            </button>
          )}

          {isLoggedIn ? (
            <>
              <span className={styles.usernameBox}>{username}</span>
              <button
                className={styles.logoutButton}
                onClick={() => {
                  logOut();
                  closeMenu(); // Close menu on logout
                }}
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