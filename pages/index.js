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
import AccountPromptModal from '../components/AccountPromptModal';
import LoginModal from '../components/LoginModal';
import NumberDisplay from '../components/NumberDisplay';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import DynamicMeta from '../components/DynamicMeta';
import HeroSection from '../components/HeroSection';

const DarkModeMap = dynamic(() => 
  import('../components/DarkModeMap')
    .then(mod => mod)
    .catch(err => {
      // Handle chunk loading errors gracefully
      console.warn('DarkModeMap chunk loading error:', err.message);
      // Return a fallback component
      return { 
        default: () => (
          <div style={{ 
            width: '100%', 
            height: '300px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'rgba(26, 31, 44, 0.9)',
            color: '#e1e1e1',
            borderRadius: '10px',
            border: '1px solid #FFD700',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <p style={{ color: '#FF4655', fontWeight: 600, marginBottom: '1rem' }}>
              Map temporarily unavailable
            </p>
            <p style={{ margin: '0.5rem 0', lineHeight: '1.5' }}>
              Visit us at: Rue Tanger, Tangier, Morocco
            </p>
          </div>
        )
      };
    }), {
  ssr: false,
  loading: () => <div style={{ 
    width: '100%', 
    height: '300px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: '#1a1f2c',
    color: '#FFD700',
    borderRadius: '10px',
    border: '1px solid #FFD700'
  }}>Loading map...</div>
});

// Main Home component first
const Home = ({ metaData }) => {
  const { user, loading, supabase, initialized } = useAuth();
  const router = useRouter();
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [processingMagicLink, setProcessingMagicLink] = useState(false);
  const [initTimeout, setInitTimeout] = useState(false);
  const [shouldShowPage, setShouldShowPage] = useState(false);

  // Enhanced timeout for auth initialization with better fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialized) {
        console.warn('Auth initialization timeout, showing page anyway');
        setInitTimeout(true);
        setShouldShowPage(true);
      }
    }, 3000);

    // Also show page when properly initialized
    if (initialized) {
      setShouldShowPage(true);
    }

    return () => clearTimeout(timer);
  }, [initialized]);

  // Debug logging for white screen issue
  useEffect(() => {
    console.log('Home page state:', {
      initialized,
      loading,
      user: user ? 'logged in' : 'not logged in',
      isVerifying,
      initTimeout,
      pathname: router.pathname
    });
  }, [initialized, loading, user, isVerifying, initTimeout, router.pathname]);

  // Enhanced magic link detection with better error handling
  useEffect(() => {
    // Skip if not in browser or if already processing
    if (typeof window === 'undefined' || processingMagicLink) return;
    
    const detectMagicLink = async () => {
      try {
        const hash = window.location.hash;
        // Check if this looks like a magic link hash fragment
        if (hash && 
            hash.includes('access_token=') && 
            hash.includes('refresh_token=') &&
            hash.includes('type=magiclink')) {
          
          console.log('Detected magic link hash on homepage');
          setProcessingMagicLink(true);
          setIsVerifying(true);
          
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
          
          // Clear hash immediately
          window.history.replaceState(null, '', window.location.pathname);
          
          // Redirect to dashboard with a slight delay
          console.log('Magic link auth successful, redirecting to dashboard');
          setTimeout(() => {
            router.replace('/dashboard');
          }, 500);
          
        }
      } catch (error) {
        console.error('Error processing magic link:', error);
        setIsVerifying(false);
        setProcessingMagicLink(false);
        setShouldShowPage(true); // Show page on error
      }
    };
    
    // Only run if supabase is available
    if (supabase) {
      detectMagicLink();
    }
  }, [supabase, router, processingMagicLink]);

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

  // Handle dashboard redirect for logged-in users - with safety checks
  useEffect(() => {
    // Only redirect if everything is properly initialized and ready
    if (!loading && !isVerifying && user && router.isReady && initialized && !processingMagicLink) {
      if (!hasAuthTokens()) {
        console.log('User is logged in and no auth tokens in URL, redirecting to dashboard');
        // Add a small delay to prevent race conditions
        setTimeout(() => {
          router.replace('/dashboard');
        }, 100);
      }
    }
  }, [user, loading, router.isReady, isVerifying, initialized, processingMagicLink]);

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

  // Enhanced loading states with better conditions
  if (isVerifying) {
    return <div className={styles.simpleLoadingWrapper}>
      {processingMagicLink ? "Processing magic link login..." : "Verifying email..."}
    </div>;
  }
  
  // Show redirecting message only for confirmed logged-in users who should be redirected
  if (user && !hasAuthTokens() && !loading && initialized) {
    return <div className={styles.simpleLoadingWrapper}>Redirecting to dashboard...</div>;
  }
  
  // Show loading if auth is not ready yet (prevent white screen)
  if (!shouldShowPage && !initTimeout) {
    return <div className={styles.simpleLoadingWrapper}>Loading...</div>;
  }

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
          <section className={styles.cardsSection}>
            <h2 className={styles.sectionTitle}>Our Services</h2>
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
                  <h3>GAMING HIGHLIGHTS</h3>
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
          </section>

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
