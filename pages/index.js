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
  const { user, loading, supabase } = useAuth();
  const router = useRouter();
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [processingMagicLink, setProcessingMagicLink] = useState(false);

  // Add magic link detection at the beginning
  useEffect(() => {
    // Skip if not in browser
    if (typeof window === 'undefined') return;
    
    const detectMagicLink = async () => {
      const hash = window.location.hash;
      // Check if this looks like a magic link hash fragment
      if (hash && 
          hash.includes('access_token=') && 
          hash.includes('refresh_token=') &&
          hash.includes('type=magiclink')) {
        
        console.log('Detected magic link hash on homepage:', hash);
        setProcessingMagicLink(true);
        setIsVerifying(true);
        
        try {
          // Parse the hash parameters
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (!accessToken || !refreshToken) {
            throw new Error('Invalid magic link parameters');
          }
          
          // Set the session with tokens
          console.log('Setting session with magic link tokens');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            throw error;
          }
          
          // Clear hash
          window.history.replaceState(null, '', window.location.pathname);
          
          // Redirect to dashboard
          console.log('Magic link auth successful, redirecting to dashboard');
          router.replace('/dashboard');
        } catch (error) {
          console.error('Error processing magic link:', error);
          setIsVerifying(false);
          setProcessingMagicLink(false);
          // If there's an error, continue with normal page display
        }
      }
    };
    
    detectMagicLink();
  }, [supabase, router]);

  // Function to check if URL has auth tokens
  const hasAuthTokens = () => {
    if (typeof window === 'undefined') return false;
    
    const urlParams = new URLSearchParams(window.location.search);
    const hasToken = urlParams.has('token') || urlParams.has('token_hash');
    const hasCode = urlParams.has('code');
    
    return hasToken || hasCode || 
           window.location.hash.includes('access_token') || 
           window.location.hash.includes('type=');
  };

  // Check for verification_pending and auth_action URL parameters
  useEffect(() => {
    if (router.isReady && !user && router.query) {
      // Safely destructure query parameters
      const auth_action = router.query.auth_action;
      const verification_pending = router.query.verification_pending;
      
      if (auth_action === 'login' || verification_pending === 'true') {
        // Show login modal if requested in URL
        setIsLoginModalOpen(true);
        
        // Show a special message if verification is pending
        if (verification_pending === 'true') {
          // Can use a toast or some other notification here if desired
          console.log('Please log in to complete your email verification');
        }
        
        // Create a new query object without these parameters
        const newQuery = { ...router.query };
        delete newQuery.auth_action;
        delete newQuery.verification_pending;
        
        // Clear the query parameters after processing
        router.replace({
          pathname: router.pathname,
          query: newQuery
        }, undefined, { shallow: true });
      }
    }
  }, [router.isReady, router.query, user, router]);

  // Handle dashboard redirect for logged-in users
  useEffect(() => {
    // Only redirect to dashboard if there's no verification happening
    if (!loading && user && !isVerifying) {
      if (!hasAuthTokens()) {
        console.log('User is logged in and no auth tokens in URL, redirecting to dashboard');
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router, isVerifying]);

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

  // Simplified loading states
  if (loading) return <LoadingScreen message="Loading..." type="default" />;
  if (isVerifying) return <LoadingScreen message={processingMagicLink ? "Processing magic link login..." : "Verifying email..."} type="verification" />;
  if (user && !hasAuthTokens()) return <LoadingScreen message="Redirecting..." type="auth" />;

  return (
    <>
      <Head>
        <title>Merrouch Gaming - Your Gaming Community</title>
        <meta name="description" content="Join Merrouch Gaming - Share your gaming highlights, connect with fellow gamers, and showcase your best moments." />
      </Head>

      <DynamicMeta {...metaData} />

      <ProtectedPageWrapper>
        <main className={styles.mainWrapper}>
          <h1 className={styles.mainHeading}>Merrouch Gaming Center | Best Gaming Center in Tangier</h1>
          
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
