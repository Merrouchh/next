import { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import Image from 'next/image';
import { AiOutlineDesktop } from 'react-icons/ai';
import dynamic from 'next/dynamic'; // Import dynamic from next/dynamic

// Dynamically import DarkModeMap with ssr: false to ensure it's client-side only
const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

const imageGallery = ['top.jpg', 'top2.jpg', 'top3.jpg', 'top4.jpg'];

export default function Home() {
  const { isLoggedIn } = useAuth();
  const [showMap, setShowMap] = useState(true);
  const router = useRouter();

  const toggleView = () => setShowMap(prevState => !prevState);

  const navigateToAvailableComputers = () => {
    router.push('/avcomputers');
  };

  const renderGallery = () => (
    imageGallery.map((img, index) => (
      <div key={index} className={styles.galleryItem}>
        {index === 3 ? (
          <a href="https://www.instagram.com/merrouchgaming/" target="_blank" rel="noopener noreferrer">
            <Image
              src={`/${img}`}
              alt={`Gallery Image ${index + 1}`}
              className={styles.galleryImage}
              width={500}
              height={300}
            />
          </a>
        ) : (
          <Image
            src={`/${img}`}
            alt={`Gallery Image ${index + 1}`}
            className={styles.galleryImage}
            width={500}
            height={300}
          />
        )}
      </div>
    ))
  );

  return (
    <>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="robots" content={isLoggedIn ? 'noindex, nofollow' : 'index, follow'} />
      </Head>

      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            {isLoggedIn ? (
              <>
                <h2 className={styles.heroTitle}>Welcome Back!</h2>
                <p className={styles.welcomeMessage}>You're logged in!</p>
                <button
                  className={`${styles.button} ${styles.avComputersButton}`}
                  onClick={navigateToAvailableComputers}
                >
                  <AiOutlineDesktop size={80} />
                </button>
              </>
            ) : (
              <>
                <h2 className={styles.heroTitle}>Welcome to Merrouch Gaming</h2>
                <p className={styles.prompt}>Please log in to access all features.</p>

                <div className={styles.buttonContainer}>
                  <button
                    className={`${styles.button} ${showMap ? styles.active : ''}`}
                    onClick={toggleView}
                  >
                    Location
                  </button>
                  <button
                    className={`${styles.button} ${!showMap ? styles.active : ''}`}
                    onClick={toggleView}
                  >
                    Gallery
                  </button>
                </div>

                <div className={styles.contentContainer}>
                  {showMap ? (
                    <div className={styles.mapContainer}>
                      <DarkModeMap /> {/* Map stays here */}
                    </div>
                  ) : (
                    <div className={styles.pictureGallery}>
                      {renderGallery()}
                    </div>
                  )}

                  <div className={styles.gamingDescription}>
                    We are a premier gaming center located in the heart of Tangier, offering a wide variety of games, fast internet, and a comfortable environment to play and socialize with fellow gamers.
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
