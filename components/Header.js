import Link from 'next/link';
import styles from './Header.module.css';
import { useState, useEffect } from 'react';
import LoginModal from './LoginModal'; // Import the LoginModal component
import { useAuth } from '../contexts/AuthContext'; // Import the useAuth hook

export default function Header() {
  const [isSticky, setIsSticky] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal

  // Access the auth context
  const { isLoggedIn, logOut, username } = useAuth(); // Using auth context values

  // Function to handle scroll event
  const handleScroll = () => {
    setIsSticky(window.scrollY > 0);
  };

  // Function to toggle the menu for mobile view
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Function to open the login modal
  const openModal = () => {
    setIsModalOpen(true);
  };

  // Function to close the login modal
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Effect to handle scroll event
  useEffect(() => {
    // Adding scroll event listener
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []); // Empty dependency array means this runs on mount and unmount

  return (
    <>
      <header className={`${styles.header} ${isSticky ? styles.sticky : ''}`}>
        <div className={styles.hamburger} onClick={toggleMenu}>
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
          <div className={styles.bar}></div>
        </div>
        <h1 className={`${styles.logo} ${styles['zen-dots-regular']}`}>
          <span className={styles.merrouch}>Merrouch</span> <span className={styles.gaming}>Gaming</span>
        </h1>
        <nav className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}>
          {/* Conditionally render Login/Logout button */}
          {isLoggedIn ? (
            <>
              <span className={styles.usernameBox}>{username}</span> {/* Display username */}
              <button className={styles.logoutButton} onClick={logOut}>
                Logout
              </button>
            </>
          ) : (
            <button className={styles.loginButton} onClick={openModal}>
              Login
            </button>
          )}
        </nav>
      </header>

      {/* Modal Component */}
      <LoginModal
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </>
  );
}
