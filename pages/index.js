import { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext'; // Import the useAuth hook
import { useRouter } from 'next/router'; // Import useRouter for navigation
import styles from '../styles/Home.module.css';
import dynamic from 'next/dynamic'; // Import dynamic from next/dynamic
import Image from 'next/image'; // Import the Image component from Next.js

const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), { 
  ssr: false 
});

export default function Home() {
  const { isLoggedIn } = useAuth(); // Access the login state from the auth context
  const [showMap, setShowMap] = useState(true); // State to toggle between map and pictures
  const router = useRouter(); // Initialize router for navigation

  const toggleView = () => {
    setShowMap((prevState) => !prevState);
  };

  const navigateToAvailableComputers = () => {
    router.push('/avcomputers'); // Navigate to /avcomputers
  };

  return (
    <div className={styles.container}>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        {isLoggedIn ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : (
          <meta name="robots" content="index, follow" />
        )}
      </Head>

      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h2 className={styles.heroTitle}>Welcome to Merrouch Gaming</h2>
            {isLoggedIn ? (
              <>
                <p className={styles.welcomeMessage}>You&apos;re logged in! Welcome back!</p>
                <button
                  className={`${styles.button} ${styles.avComputersButton}`}
                  onClick={navigateToAvailableComputers}
                >
                  View Available Computers
                </button>
              </>
            ) : (
              <>
                <p className={styles.prompt}>Please log in to access all features.</p>
                <div className={styles.gamingInfo}>
                  {/* Buttons to toggle the view */}
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

                  {/* Conditionally render map or pictures */}
                  <div className={styles.contentContainer}>
                    {showMap ? (
                      <div className={styles.mapContainer}>
                        <DarkModeMap />
                      </div>
                    ) : (
                      <div className={styles.pictureGallery}>
                        {['top.jpg', 'top2.jpg', 'top3.jpg', 'top4.jpg'].map((img, index) => (
                          index === 3 ? (
                            // Fourth image is a link to Instagram
                            <a
                              key={index}
                              href="https://www.instagram.com/merrouchgaming/"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Image
                                src={`/${img}`}
                                alt={`Gallery Image ${index + 1}`}
                                className={styles.galleryImage}
                                width={500} // Specify width
                                height={300} // Specify height
                              />
                            </a>
                          ) : (
                            // Other images are displayed normally
                            <Image
                              key={index}
                              src={`/${img}`}
                              alt={`Gallery Image ${index + 1}`}
                              className={styles.galleryImage}
                              width={500} // Specify width
                              height={300} // Specify height
                            />
                          )
                        ))}
                      </div>
                    )}
                    <div className={styles.gamingDescription}>
                      We are a premier gaming center located in the heart of Tangier, offering a wide variety of games, fast internet, and a comfortable environment to play and socialize with fellow gamers.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
