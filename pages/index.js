import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
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

const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

export default function Home() {
  const { isLoggedIn, loading, user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('hero');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [pageState, setPageState] = useState({
    isLoading: true,
    isError: false
  });

  useEffect(() => {
    if (!loading) {
      if (isLoggedIn && user && router.pathname === '/') {
        router.replace('/dashboard');
      } else {
        setPageState({ isLoading: false, isError: false });
      }
    }
  }, [loading, isLoggedIn, user, router.pathname]);

  // Add scroll progress handler
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

      <Header />
      
      <div className={styles.scrollProgress}>
        <div 
          className={styles.scrollBar} 
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <main className={styles.mainWrapper}>
        <nav className={styles.navDots}>
          {[
            { id: 'hero', label: 'Home' },
            { id: 'packages', label: 'Packages' },
            { id: 'features', label: 'Features' },
          ].map(section => (
            <button
              key={section.id}
              className={`${styles.navDot} ${activeSection === section.id ? styles.active : ''}`}
              onClick={() => scrollToSection(section.id)}
              aria-label={section.label}
            >
              <span className={styles.dotTooltip}>{section.label}</span>
            </button>
          ))}
        </nav>

        <section data-section="hero" className={`${styles.section} ${styles.mainHero}`}>
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
                  onClick={() => router.push('/avcomputers')}
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
                      0531098983
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
        </section>

        <section data-section="packages" id="packages" className={`${styles.section} ${styles.packages}`}>
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
        </section>

        <section data-section="features" className={`${styles.section} ${styles.features}`}>
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
        </section>
      </main>
    </>
  );
}
