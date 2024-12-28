import { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import Image from 'next/image';
import { AiOutlineDesktop, AiOutlineEnvironment, AiOutlinePicture, AiOutlineShop } from 'react-icons/ai'; // Import the Shop icon
import dynamic from 'next/dynamic'; // Import dynamic from next/dynamic
import NotificationButton from '../components/NotificationButton'; // Import the NotificationButton component

// Dynamically import DarkModeMap with ssr: false to ensure it's client-side only
const DarkModeMap = dynamic(() => import('../components/DarkModeMap'), {
  ssr: false,
});

const imageGallery = ['top.jpg', 'top2.jpg', 'top3.jpg', 'top4.jpg'];

export default function Home() {
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState('map'); // State to control active tab (map or gallery)
  const [status, setStatus] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission); // Debug log
        if (permission === 'granted') {
          navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(subscription => {
              console.log('Push subscription:', subscription); // Debug log
              const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BI77cEBaJDS7BT_bpo8zt7jjIdZhXVmMr2881f2TNVIUo6irIsgqp9KZYXeAVggEvXN9nyIQBUupl1RLUPgs9EM';
              if (!subscription) {
                registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                }).then(newSubscription => {
                  console.log('New push subscription:', newSubscription); // Debug log
                  subscribeUser(newSubscription);
                }).catch(error => {
                  console.error('Failed to subscribe the user:', error);
                });
              } else {
                subscribeUser(subscription);
              }
            });
          });
        }
      });
    }

    // Check if the user is admin2
    const username = localStorage.getItem('username');
    if (username === 'admin2') {
      setIsAdmin(true);
    }
  }, [isLoggedIn]);

  const subscribeUser = (subscription) => {
    fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription }),
    }).then(response => {
      if (response.ok) {
        console.log('User is subscribed');
      } else {
        console.error('Failed to subscribe the user');
      }
    });
  };

  const toggleView = (view) => setActiveTab(view);

  const navigateToAvailableComputers = () => {
    router.push('/avcomputers'); // Navigate to available computers page
  };

  const navigateToShop = () => {
    router.push('/shop'); // Navigate to the shop page
  };

  const toggleStatus = async (newStatus) => {
    const response = await fetch('/api/toggleStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (response.ok) {
      setStatus(newStatus);
      alert(`Status set to ${newStatus}`);
    } else {
      alert('Failed to set status');
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

                {/* Clickable Buttons */}
                <div className={styles.buttonContainer}>
                  <button
                    className={`${styles.button} ${styles.avComputersButton}`}
                    onClick={navigateToAvailableComputers}
                    style={{
                      position: 'relative',
                      zIndex: 10, // Ensure it's above other elements
                      touchAction: 'manipulation', // Prevents interference with touch scrolling
                    }}
                  >
                    <AiOutlineDesktop size={80} />
                  </button>

                  <button
                    className={`${styles.button} ${styles.shopButton}`}
                    onClick={navigateToShop} // Navigate to the shop page
                    style={{
                      position: 'relative',
                      zIndex: 10, // Ensure it's above other elements
                      touchAction: 'manipulation', // Prevents interference with touch scrolling
                    }}
                  >
                    <AiOutlineShop size={80} /> {/* Shop Icon */}
                  </button>
                </div>

                <NotificationButton /> {/* Add NotificationButton component */}

                {isAdmin && (
                  <div className={styles.statusButtons}>
                    <button onClick={() => toggleStatus('on')}>Open</button>
                    <button onClick={() => toggleStatus('off')}>Close</button>
                  </div>
                )}
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
                    style={{
                      position: 'relative',
                      zIndex: 10, // Ensure it's above other elements
                      touchAction: 'manipulation', // Prevents interference with touch scrolling
                    }}
                  >
                    <AiOutlineEnvironment size={40} /> {/* Location Icon */}
                  </button>
                  <button
                    className={`${styles.button} ${activeTab === 'gallery' ? styles.active : ''}`}
                    onClick={() => toggleView('gallery')}
                    style={{
                      position: 'relative',
                      zIndex: 10, // Ensure it's above other elements
                      touchAction: 'manipulation', // Prevents interference with touch scrolling
                    }}
                  >
                    <AiOutlinePicture size={40} /> {/* Gallery Icon */}
                  </button>
                  <button
                    className={`${styles.button} ${styles.shopButton}`}
                    onClick={navigateToShop} // Navigate to the shop page
                    style={{
                      position: 'relative',
                      zIndex: 10, // Ensure it's above other elements
                      touchAction: 'manipulation', // Prevents interference with touch scrolling
                    }}
                  >
                    <AiOutlineShop size={40} /> {/* Shop Icon */}
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

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error('Base64 string is required');
  }
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}