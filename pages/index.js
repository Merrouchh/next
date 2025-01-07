import React, { useState, useEffect, Fragment } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { 
  AiOutlineEnvironment, 
  AiOutlineDesktop, 
  AiOutlineWifi,
  AiOutlineTeam,
  AiOutlineInstagram, 
  AiOutlinePhone
} from 'react-icons/ai';
import dynamic from 'next/dynamic';
import LoadingScreen from '../components/LoadingScreen';
import { Dialog } from '@headlessui/react';
import { createClient } from '../utils/supabase/client';

// Update the dynamic import
const LoginModal = dynamic(
  () => import('../components/LoginModal'),
  {
    ssr: false,
    loading: () => <div>Loading...</div>,
  }
);

const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

// Initialize Supabase client
const supabase = createClient();

export default function Home() {
  const { isLoggedIn, loading, user } = useAuth();
  const router = useRouter();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [pageState, setPageState] = useState({
    isLoading: true,
    isError: false
  });
  const [copied, setCopied] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (isLoggedIn && user && router.pathname === '/') {
        router.replace('/dashboard');
      } else {
        setPageState({ isLoading: false, isError: false });
      }
    }
  }, [loading, isLoggedIn, user, router, router.pathname]);

  // Update scroll progress effect
  useEffect(() => {
    const handleScroll = () => {
      const winScroll = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollProgress(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const cleanupSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signOut();
      }
    };
    
    cleanupSession();
  }, []);

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText('0531098983');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleAvailabilityClick = () => {
    if (!isLoggedIn) {
      setShowWelcomeDialog(true);
    } else {
      router.push('/avcomputers');
    }
  };

  // Show loading state only if still initializing
  if (loading || pageState.isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  // Don't show home page content while redirecting logged-in users
  if (isLoggedIn && user) {
    return <LoadingScreen message="Redirecting..." />;
  }

  const features = [
    {
      icon: <AiOutlineDesktop size={32} />,
      title: "High-End Gaming Rigs",
      description: "Ryzen 7 7700, RTX 3070 Graphics & 180Hz Pro Displays"
    },
    {
      icon: <AiOutlineWifi size={32} />,
      title: "200 Mbps Internet",
      description: "Ultra-Low Ping for Competitive Gaming"
    },
    {
      icon: <AiOutlineTeam size={32} />,
      title: "Gaming Community Hub",
      description: "Local Tournaments & Events"
    }
  ];

  const galleryImages = [
    { 
      src: '/top.jpg', 
      alt: 'Gaming Setup 1',
    },
    { 
      src: '/top2.jpg', 
      alt: 'Gaming Setup 2',
    },
    { 
      src: '/top3.jpg', 
      alt: 'Gaming Setup 3',
    }
  ];

  const handleButtonTouch = (e) => {
    e.currentTarget.style.transform = 'scale(0.98)';
    setTimeout(() => {
      e.currentTarget.style.transform = 'scale(1)';
    }, 100);
  };

  const scrollToNextSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const scrollToSection = (sectionId) => {
    const section = document.querySelector(`[data-section="${sectionId}"]`);
    if (section) {
      const headerOffset = 60;
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <Head>
        <title>Merrouch Gaming Center</title>
        <meta name="description" content="Experience gaming at its finest with our high-end PCs, fast internet, and vibrant gaming community in Tangier." />
        <meta name="robots" content={isLoggedIn ? 'noindex, nofollow' : 'index, follow'} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#0f1119" />
      </Head>
      
      <div className={styles.scrollProgress}>
        <div 
          className={styles.scrollBar} 
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <main className={styles.pageWrapper}>
        <section className={styles.mainSection}>
          {/* Hero Content */}
          <div className={styles.heroContent}>
            <div className={styles.gridContainer}>
              <div className={styles.infoColumn}>
                <div className={styles.logoWrapper}>
                  <Image
                    src="/logomobile.png"
                    alt="Merrouch Gaming"
                    width={150}
                    height={75}
                    priority
                    className={`${styles.brandLogo} ${styles.desktopOnly}`}
                  />
                  <div className={`${styles.textLogo} ${styles.mobileOnly}`}>
                    <span className={styles.welcome}>Welcome To</span>
                    <span className={styles.merrouch}>MERROUCH</span>{' '}
                    <span className={styles.gaming}>GAMING</span>
                  </div>
                </div>
                <h1 className={styles.mainHeading}>
                  Professional Gaming Center<br />
                  in the Heart of Tangier
                </h1>
                <div className={styles.quickStats}>
                  <div className={styles.stat}>
                    <AiOutlineDesktop size={24} />
                    <span>Only Pc Gamers , Yes we got ps4 controllers for FC25 or simply controller players </span>
                  </div>
                  <div className={styles.stat}>
                    <AiOutlineWifi size={24} />
                    <span>200 Mbps Internet , Low Ping , Smooth Gaming Experience</span>
                  </div>
                </div>
                <div className={styles.actionButtons}>
                  <button 
                    className={styles.primaryButton}
                    onClick={handleAvailabilityClick}
                  >
                    Check Availability
                  </button>
                  <button 
                    className={styles.outlineButton}
                    onClick={() => scrollToNextSection('packages')}
                  >
                    View Prices
                  </button>
                  <button 
                    className={styles.outlineButton}
                    onClick={() => router.push('/topusers')}
                  >
                    Top Users
                  </button>
                </div>
              </div>

              <div className={styles.mapColumn}>
                <div className={styles.mapCard}>
                  <div className={styles.mapWrapper}>
                    <DarkModeMap />
                  </div>
                  <div className={styles.locationDetails}>
                    <div className={styles.contactInfo}>
                      <div className={styles.contactItem}>
                        <AiOutlineEnvironment  />&nbsp;
                        Avenue Abi Elhassan Chadili, Tangier
                      </div>
                      <div className={styles.contactItem}>
                        <AiOutlinePhone />&nbsp;
                        <span 
                          onClick={handleCopyNumber}
                          style={{ cursor: 'pointer' }}
                          title="Click to copy"
                        >
                          {copied ? 'Copied!' : '0531098983'}
                        </span>
                      </div>
                      <div className={styles.contactItem}>
                        <AiOutlineInstagram />&nbsp;
                        <a 
                          href="https://instagram.com/merrouchgaming" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.socialLink}
                        >
                          @merrouchgaming
                        </a>
                      </div>
                  
                    </div>
                    
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Packages Content */}
          <div id="packages" className={styles.packagesContent}>
            <div className={styles.containerNarrow}>
              <h2 className={styles.sectionTitle}>Gaming Packages</h2>
              <div className={styles.packagesGrid}>
                <div className={`${styles.pricingCard} ${styles.glowEffect}`}>
                  <div className={styles.pricingHeader}>
                    <h3>Normal PC</h3>
                    <div className={styles.price}>15 MAD<span>/hour</span></div>
                  </div>
                  <ul className={styles.pricingFeatures}>
                    <li>I5 10400F, 2060, 144Hz</li>
                    <li>Premium Peripherals</li>
                    <li>Fun Gaming</li>
                  </ul>
                </div>
                <div className={`${styles.pricingCard} ${styles.featured} ${styles.glowEffect}`}>
                  <div className={styles.pricingHeader}>
                    <h3>VIP PC</h3>
                    <div className={styles.price}>18 MAD<span>/hour</span></div>
                  </div>
                  <ul className={styles.pricingFeatures}>
                    <li>Ryzen 7 7700, RTX 3070, 180Hz </li>
                    <li>Premium Peripherals</li>
                    <li>Serious Gaming</li>
                  </ul>
                </div>
              </div>
              <div className={styles.learnMoreButton}>
                <button 
                  className={styles.primaryButton}
                  onClick={() => router.push('/shop')}
                >
                  Learn More About Our Packages
                </button>
              </div>
            </div>
          </div>

          {/* Features Content */}
          <div className={styles.featuresContent}>
            <div className={styles.containerWide}>
              <div className={styles.featuresContent}>
                <div className={styles.featuresGrid}>
                  {features.map((feature, index) => (
                    <div key={index} className={`${styles.featureCard} ${styles.glowEffect}`}>
                      <div className={styles.featureIcon}>{feature.icon}</div>
                      <div className={styles.featureText}>
                        <h3>{feature.title}</h3>
                        <p>{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.galleryGrid}>
                  {galleryImages.map((image, index) => (
                    <div key={index} className={styles.galleryItem}>
                      <Image
                        src={image.src}
                        alt={image.alt}
                        layout="fill"
                        objectFit="cover"
                        className={styles.galleryImage}
                        priority={index === 0}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      {showWelcomeDialog && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeButton}
              onClick={() => setShowWelcomeDialog(false)}
            >
              &times;
            </button>
            <h2 className={styles.modalTitle}>Welcome to Merrouch Gaming!</h2>
            <div className={styles.welcomeContent}>
              <p>To check PC availability and make reservations, you'll need a Merrouch Gaming account.</p>
              <p>If you're already at our gaming center, we'll help you create an account in person.</p>
              <p>If you already have an account, please log in to continue.</p>
            </div>
            <div className={styles.welcomeActions}>
              <button
                className={styles.loginButton}
                onClick={() => {
                  setShowWelcomeDialog(false);
                  setShowLoginModal(true);
                }}
              >
                Login
              </button>
              <button
                className={styles.outlineButton}
                onClick={() => setShowWelcomeDialog(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <LoginModal 
        key="login-modal"
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </>
  );
}
