import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/AdminTopNav.module.css';
import {
  FaTachometerAlt,
  FaUsers,
  FaCalendarAlt,
  FaDesktop,
  FaChartLine,
  FaBell,
  FaTrophy
} from 'react-icons/fa';
import { AiOutlineHome } from 'react-icons/ai';
import MobileMenu from './MobileMenu';

/**
 * Top navigation for admin pages.
 * Keeps a similar visual style to the public header but with admin-focused links.
 */
export default function AdminTopNav({ currentPath }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef(null);
  const hamburgerRef = useRef(null);

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: <FaTachometerAlt />, adminOnly: false },
    { path: '/admin/users', label: 'Users', icon: <FaUsers />, adminOnly: true },
    { path: '/admin/events', label: 'Events', icon: <FaCalendarAlt />, adminOnly: true },
    { path: '/admin/events/brackets', label: 'Brackets', icon: <FaTrophy />, adminOnly: true },
    { path: '/admin/sessions', label: 'Sessions', icon: <FaDesktop />, adminOnly: true },
    { path: '/admin/queue', label: 'Queue', icon: <FaUsers />, adminOnly: false },
    { path: '/admin/stats', label: 'Analytics', icon: <FaChartLine />, adminOnly: true },
    { path: '/admin/notifications', label: 'Notifications', icon: <FaBell />, adminOnly: true },
  ];

  const filteredNav = navItems.filter(item => {
    if (user?.isAdmin) return true;
    if (user?.isStaff) return !item.adminOnly && item.path === '/admin/queue';
    return false;
  });


  const isActive = (path) => {
    if (path === '/admin') return currentPath === '/admin';
    return currentPath.startsWith(path);
  };

  const closeMenu = () => setIsMenuOpen(false);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

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

  return (
    <div className={styles.adminTopNavWrapper}>
      <div className={styles.adminTopNav}>
        <div className={styles.navLeft}>
          <button
            ref={hamburgerRef}
            className={`${styles.hamburger} ${isMenuOpen ? styles.open : ''}`}
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <span className={styles.bar}></span>
            <span className={styles.bar}></span>
            <span className={styles.bar}></span>
          </button>
        </div>

        <div className={styles.logoContainer}>
          <Link href="/admin" className={styles.logoLink}>
            <Image
              src="/logomobile.png"
              alt="Merrouch Gaming"
              width={200}
              height={50}
              className={styles.logo}
              priority
            />
          </Link>
        </div>

        <div className={styles.navCenter}>
          <div className={styles.navLinks}>
            {filteredNav.map(item => (
              <Link
                key={item.path}
                href={item.path}
                className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.navRight}>
          <Link href="/dashboard" className={styles.dashboardLink}>
            <AiOutlineHome />
          </Link>
        </div>
      </div>

      <MobileMenu isOpen={isMenuOpen}>
        <div ref={navRef} className={styles.mobileMenuContent}>
          <div className={styles.mobileHeader}>
            <span className={styles.mobileTitle}>Admin Menu</span>
          </div>
          <div className={styles.mobileNavLinks}>
            {filteredNav.map((item) => (
              <button
                key={item.path}
                className={`${styles.mobileNavButton} ${isActive(item.path) ? styles.active : ''}`}
                onClick={() => {
                  router.push(item.path);
                  closeMenu();
                }}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </MobileMenu>
    </div>
  );
}

