import { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import Image from 'next/image';
import { AiOutlineDesktop, AiOutlineEnvironment, AiOutlinePicture } from 'react-icons/ai'; // Import icons for Location, Gallery, and Desktop
import dynamic from 'next/dynamic'; // Import dynamic from next/dynamic
import Draggable from 'react-draggable'; // Import Draggable

// Dynamically import DarkModeMap with ssr: false to ensure it's client-side only
const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

const imageGallery = ['top.jpg', 'top2.jpg', 'top3.jpg', 'top4.jpg'];

export default function Home() {
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState('map'); // State to control active tab (map or gallery)
  const router = useRouter();

  const [isDragged, setIsDragged] = useState(false); // State to track if the icon was dragged
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 }); // Track the initial position of the icon
  const [position, setPosition] = useState({ x: 0, y: 0 }); // State to store current position of the icon
  const [transitionDuration, setTransitionDuration] = useState('0s'); // Transition duration state

  const toggleView = (view) => setActiveTab(view);

  const navigateToAvailableComputers = () => {
    if (!isDragged) { // Only navigate if the icon was not dragged
      router.push('/avcomputers');
    }
    setIsDragged(false); // Reset drag state after navigation or cancel
  };

  const handleDragStart = (e, data) => {
    setIsDragged(true); // Mark as dragged when the user starts dragging the icon
    setInitialPosition({ x: data.x, y: data.y }); // Store the initial position of the icon

    // Set the transition to '0s' for fast grabbing
    setTransitionDuration('0s');
  };

  const handleDragStop = (e, data) => {
    // If the icon's position has changed significantly, mark it as dragged
    if (Math.abs(data.x - initialPosition.x) > 10 || Math.abs(data.y - initialPosition.y) > 10) {
      setIsDragged(true);
    } else {
      setIsDragged(false); // If the icon hasn't moved much, don't treat it as dragged
    }

    // Smooth reset to default position (0, 0) after drag
    setPosition({ x: 0, y: 0 });
    setTransitionDuration('0.5s'); // Smooth transition when the icon goes back
  };

  const handleClick = (e) => {
    // Prevent click if the icon was dragged
    if (isDragged) {
      e.preventDefault(); // Prevent default behavior if dragged
    } else {
      navigateToAvailableComputers(); // Proceed with navigation on click
    }
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
                <p className={styles.welcomeMessage}>You&apos;re logged in!</p>

                {/* Draggable Icon, Only when logged in */}
                <Draggable
                  position={position} // Set position to current state to reset to the default position
                  onStart={handleDragStart} // Trigger when dragging starts
                  onStop={handleDragStop} // Trigger when dragging stops
                >
                  <button
                    className={`${styles.button} ${styles.avComputersButton}`}
                    onClick={handleClick} // Handle click here to differentiate between click and drag
                    style={{ transition: `transform ${transitionDuration} ease-in-out` }} // Apply dynamic transition duration
                  >
                    <AiOutlineDesktop size={80} />
                  </button>
                </Draggable>
              </>
            ) : (
              <>
                <h2 className={styles.heroTitle}>Welcome to Merrouch Gaming</h2>
                <p className={styles.prompt}>Please log in to access all features.</p>

                <div className={styles.buttonContainer}>
                  {/* Icons instead of text buttons */}
                  <button
                    className={`${styles.button} ${activeTab === 'map' ? styles.active : ''}`}
                    onClick={() => toggleView('map')}
                  >
                    <AiOutlineEnvironment size={40} /> {/* Location Icon */}
                  </button>
                  <button
                    className={`${styles.button} ${activeTab === 'gallery' ? styles.active : ''}`}
                    onClick={() => toggleView('gallery')}
                  >
                    <AiOutlinePicture size={40} /> {/* Gallery Icon */}
                  </button>
                </div>

                <div className={styles.contentContainer}>
                  {activeTab === 'map' ? (
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
