import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import { 
  AiOutlineEnvironment, 
  AiOutlineInstagram, 
  AiOutlinePhone
} from 'react-icons/ai';
import { MdExplore } from 'react-icons/md';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Components
import LoadingScreen from '../components/LoadingScreen';
import AccountPromptModal from '../components/AccountPromptModal';
import LoginModal from '../components/LoginModal';
import NumberDisplay from '../components/NumberDisplay';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import DynamicMeta from '../components/DynamicMeta';
import HeroSection from '../components/HeroSection';

const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

// Main Home component first
const Home = ({ metaData }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [_progress, setProgress] = useState(0);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Add effect to handle redirection
  useEffect(() => {
    if (!loading && user) {
      console.log('Home: User is logged in, redirecting to dashboard');
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

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
    <>
      <Head>
        <title>Merrouch Gaming - Your Gaming Community</title>
        <meta name="description" content="Join Merrouch Gaming - Share your gaming highlights, connect with fellow gamers, and showcase your best moments." />
      </Head>

      <DynamicMeta {...metaData} />

      <ProtectedPageWrapper progress={scrollProgress}>
        <main className={styles.mainWrapper}>
          <HeroSection 
            onCheckAvailability={handleCheckAvailability}
            router={router}
          />

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
    </>
  );
};

export default Home;

export async function getServerSideProps() {
  // Import the schema functions
  const { getFAQPageSchema } = require('../components/FAQSchema');
  const { getPriceRangeSchema } = require('../components/PriceRangeSchema');
  
  // Get both schema objects
  const faqSchema = getFAQPageSchema();
  const priceSchema = getPriceRangeSchema();
  
  return {
    props: {
      metaData: {
        title: "Merrouch Gaming Center | RTX 3070 Gaming PCs in Tangier",
        description: "Experience premium gaming with RTX 3070 PCs, 200Mbps internet, and competitive prices. Join Tangier's best gaming community. Share highlights, connect with gamers, and enjoy top-tier gaming equipment.",
        image: "https://merrouchgaming.com/top.jpg",
        url: "https://merrouchgaming.com",
        type: "website",
        openGraph: {
          title: "Premium Gaming Center in Tangier | RTX 3070 PCs",
          description: "Join Tangier's premier gaming community. RTX 3070 PCs, 200Mbps internet, competitive prices.",
          images: [
            {
              url: "https://merrouchgaming.com/top.jpg",
              width: 1200,
              height: 630,
              alt: "Merrouch Gaming Center"
            }
          ]
        },
        // Combine schemas into an array of structured data
        structuredData: [faqSchema, priceSchema]
      }
    }
  };
}
