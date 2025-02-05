import React, { useState, useEffect } from 'react';
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
import AccountPromptModal from '../components/AccountPromptModal';
import LoginModal from '../components/LoginModal';
import NumberDisplay from '../components/NumberDisplay';
import { MdGames, MdLeaderboard, MdExplore } from 'react-icons/md';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { NextSeo } from 'next-seo';
import DynamicMeta from '../components/DynamicMeta';

const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [loading, user]);

  const [progress, setProgress] = useState(0);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Scroll progress effect
  useEffect(() => {
    const onScroll = () => {
      const pixelsFromTop = window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const scrollableHeight = pageHeight - windowHeight;
      const percentage = (pixelsFromTop / scrollableHeight) * 100;
      setProgress(percentage);
    };

    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [router]);

  const handleCheckAvailability = () => {
    if (!user) {
      setShowAccountPrompt(true);
    } else {
      router.push('/avcomputers');
    }
  };

  const handleLogin = () => {
    setShowAccountPrompt(false);
    setIsLoginModalOpen(true);
  };

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (user) {
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
    { src: '/top.jpg', alt: 'Gaming Setup 1' },
    { src: '/top2.jpg', alt: 'Gaming Setup 2' },
    { src: '/top3.jpg', alt: 'Gaming Setup 3' }
  ];

  return (
    <ProtectedPageWrapper>
      <DynamicMeta
        title="Cyber Merrouch Gaming Center | Best Gaming Center in Tangier"
        description="Experience premium gaming with RTX 3070 PCs and 200Mbps internet. The best gaming café in Tangier, Morocco."
        image="https://merrouchgaming.com/top.jpg"
        url="https://merrouchgaming.com"
        type="website"
      />

      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar}
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className={styles.mainWrapper}>
        <div className={styles.hero}>
          <div className={styles.gridContainer}>
            <div className={styles.infoColumn}>
              <div className={styles.logoWrapper}>
                <Image
                  src="/logomobile.png"
                  alt="Merrouch Gaming"
                  width={150}
                  height={75}
                  priority
                  className={styles.brandLogo}
                />
                <div className={styles.textLogo}>
                  <span className={styles.welcome}>Welcome To</span>
                  <div>
                    <span className={styles.merrouch}>Merrouch</span>{' '}
                    <span className={styles.gaming}>Gaming</span>
                  </div>
                </div>
              </div>
              <h1 className={styles.title}>
              Professional Gaming Center
              in the Heart of Tangier
              </h1>
              <div className={styles.discoverSection}>
                <div 
                  className={styles.discoverCard}
                  onClick={() => router.push('/discover')}
                >
                  <div className={styles.cardIcon}>
                    <MdExplore />
                  </div>
                  <h2>Gaming Highlights</h2>
                  <p>Watch amazing moments from our community</p>
                </div>
              </div>
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
                  onClick={handleCheckAvailability}
                >
                  Check Availability
                </button>
                <button 
                  className={styles.outlineButton}
                  onClick={() => router.push('/shop')}
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
                      <AiOutlineEnvironment />&nbsp;
                      Avenue Abi Elhassan Chadili, Tangier
                    </div>
                    <div className={styles.contactItem}>
                      <AiOutlinePhone />&nbsp;
                      <NumberDisplay number="0531098983" />
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

        <div className={styles.packages}>
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

        <div className={styles.features}>
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

        <div className={styles.grid}>
          <div 
            className={`${styles.card} ${styles.discoverCard}`}
            onClick={() => router.push('/discover')}
          >
            <div className={styles.cardIcon}>
              <MdExplore />
            </div>
            <h2>Discover Gaming Highlights &rarr;</h2>
            <p>Watch amazing gaming moments from our community.</p>
          </div>

          <div className={styles.card} onClick={() => router.push('/avcomputers')}>
            <div className={styles.cardIcon}>
              <MdGames />
            </div>
            <h2>Available Computers &rarr;</h2>
            <p>Check which gaming stations are currently available.</p>
          </div>

          <div className={styles.card} onClick={() => router.push('/topusers')}>
            <div className={styles.cardIcon}>
              <MdLeaderboard />
            </div>
            <h2>Top Users &rarr;</h2>
            <p>See who's leading the gaming charts this month.</p>
          </div>
        </div>
      </main>

      {showAccountPrompt && (
        <AccountPromptModal 
          onClose={() => setShowAccountPrompt(false)} 
          onLogin={handleLogin} 
        />
      )}

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />

    </ProtectedPageWrapper>
  );
}
