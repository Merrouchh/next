import React, { useState, useEffect } from 'react';
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
import { MdExplore } from 'react-icons/md';
import dynamic from 'next/dynamic';

// Components
import LoadingScreen from '../components/LoadingScreen';
import AccountPromptModal from '../components/AccountPromptModal';
import LoginModal from '../components/LoginModal';
import NumberDisplay from '../components/NumberDisplay';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import DynamicMeta from '../components/DynamicMeta';

const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

// Constants
const FEATURES = [
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

const GALLERY_IMAGES = [
  { 
    src: '/top.jpg', 
    alt: 'High-End Gaming Setup',
    title: 'Premium Gaming Experience' 
  },
  { 
    src: '/top2.jpg', 
    alt: 'Professional Gaming Environment',
    title: 'Professional Environment'
  },
  { 
    src: '/top3.jpg', 
    alt: 'Gaming Community Space',
    title: 'Community Gaming'
  }
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [_progress, setProgress] = useState(0);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [loading, user, router]);

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

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentProgress = (window.scrollY / totalScroll) * 100;
      setScrollProgress(Math.min(currentProgress, 100));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  if (loading) return <LoadingScreen message="Loading..." />;
  if (user) return <LoadingScreen message="Redirecting..." />;

  return (
    <ProtectedPageWrapper progress={scrollProgress}>
      <DynamicMeta
        title="Cyber Merrouch Gaming Center | Best Gaming Center in Tangier"
        description="Experience premium gaming with RTX 3070 PCs and 200Mbps internet. The best gaming café in Tangier, Morocco."
        image="https://merrouchgaming.com/top.jpg"
        url="https://merrouchgaming.com"
        type="website"
      />

      <main className={styles.mainWrapper}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroGallery}>
            {GALLERY_IMAGES.map((image, index) => (
              <div key={index} className={styles.heroImage}>
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  loading={index < 2 ? "eager" : "lazy"}
                  className={styles.imageOverlay}
                  quality={75}
                  placeholder="blur"
                  blurDataURL={image.src}
                  decoding="async"
                />
                <div className={styles.imageCaption}>
                  <h3>{image.title}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.heroContent}>
            <div className={styles.logoWrapper}>
              <Image
                src="/logomobile.png"
                alt="Merrouch Gaming"
                width={180}
                height={90}
                loading="lazy"
                className={styles.brandLogo}
                quality={75}
              />
              <div className={styles.textLogo}>
                <span className={styles.welcome}>Welcome To</span>
                <div>
                  <span className={styles.merrouch}>Merrouch</span>{' '}
                  <span className={styles.gaming}>Gaming</span>
                </div>
              </div>
            </div>

            <h1 className={styles.mainTitle}>
              Professional Gaming Center<br />
              <span>in the Heart of Tangier</span>
            </h1>

            {/* Quick Info */}
            <div className={styles.quickInfo}>
              <div className={styles.infoItem}>
                <AiOutlineDesktop size={20} />
                <span>Only PC Gamers , Yes we got ps4 controllers for FC25 or simply controller players</span>
              </div>
              <div className={styles.infoItem}>
                <AiOutlineWifi size={20} />
                <span>200 Mbps Internet , Low Ping , Smooth Gaming Experience</span>
              </div>
            </div>
          </div>
        </section>

        {/* Cards Section */}
        <div className={styles.cardContainer}>
          {/* Highlights Card */}
          <div className={styles.cardHighlight}>
            <div 
              className={styles.highlightContent}
              onClick={() => router.push('/discover')}
            >
              <div className={styles.highlightIcon}>
                <MdExplore size={24} />
              </div>
              <h2>GAMING HIGHLIGHTS</h2>
              <p>Watch amazing moments from our community</p>
            </div>
            <div className={styles.contactInfo}>
              <a 
                href="https://www.google.com/maps/place/Cyber+Gaming+Merrouch/@35.7686889,-5.8127333,922m/data=!3m1!1e3!4m14!1m7!3m6!1s0xd0b8119c440343d:0x93cde0af29aeb9c5!2sCyber+Gaming+Merrouch!8m2!3d35.7686846!4d-5.8101584!16s%2Fg%2F11s_sxbgx1!3m5!1s0xd0b8119c440343d:0x93cde0af29aeb9c5!8m2!3d35.7686846!4d-5.8101584!16s%2Fg%2F11s_sxbgx1?entry=ttu&g_ep=EgoyMDI1MDExMC4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer" 
                className={styles.contactItem}
              >
                <AiOutlineEnvironment />&nbsp;
                Avenue Abi Elhassan Chadili, Tangier
              </a>
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

          {/* Map Card */}
          <div className={styles.cardMap}>
            <div className={styles.mapWrapper}>
              <DarkModeMap />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.infoSection}>
          <div className={styles.actionButtons}>
            <button 
              className={styles.primaryButton}
              onClick={handleCheckAvailability}
            >
              CHECK AVAILABILITY
            </button>
            <button 
              className={styles.outlineButton}
              onClick={() => router.push('/shop')}
            >
              VIEW PRICES
            </button>
            <button 
              className={styles.outlineButton}
              onClick={() => router.push('/topusers')}
            >
              TOP USERS
            </button>
          </div>
        </div>

        {/* Packages Section */}
        <section className={styles.packages}>
          <div className={styles.containerNarrow}>
            <h2 className={styles.sectionTitle}>Gaming Packages</h2>
            <div className={styles.packagesGrid}>
              {/* Normal PC Card */}
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
              {/* VIP PC Card */}
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

        {/* Features Section */}
        <section className={styles.features}>
          <div className={styles.containerWide}>
            <div className={styles.featuresContent}>
              <div className={styles.featuresGrid}>
                {FEATURES.map((feature, index) => (
                  <div key={index} className={`${styles.featureCard} ${styles.glowEffect}`}>
                    <div className={styles.featureIcon}>{feature.icon}</div>
                    <div className={styles.featureText}>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
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
