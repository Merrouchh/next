import React from 'react';
import styles from '../../styles/EditProfile.module.css';
import { FaGamepad, FaTools } from 'react-icons/fa';
import { AiOutlineInfoCircle } from 'react-icons/ai';

const GamingSection = () => {
  // Styles for the "Coming Soon" section
  const comingSoonStyles = {
    container: {
      opacity: 0.7,
      pointerEvents: 'none',
      position: 'relative',
    },
    overlay: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '30px 20px',
      border: '2px dashed #4a4a4a',
      borderRadius: '8px',
      margin: '20px 0',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      color: '#b3b3b3',
      textAlign: 'center',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '15px',
      color: '#ffcc00',
    },
    icon: {
      fontSize: '50px',
      marginBottom: '20px',
      color: '#ffcc00',
    },
    description: {
      fontSize: '16px',
      lineHeight: '1.5',
      maxWidth: '500px',
      marginBottom: '10px',
    },
    info: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: '#8a8a8a',
      marginTop: '10px',
    }
  };

  return (
    <section className={styles.section} style={comingSoonStyles.container}>
      <div className={styles.sectionHeader}>
        <FaGamepad className={styles.sectionIcon} />
        <h2>Gaming Account</h2>
      </div>
      
      <div style={comingSoonStyles.overlay}>
        <FaTools style={comingSoonStyles.icon} />
        <h3 style={comingSoonStyles.title}>Coming Soon</h3>
        <p style={comingSoonStyles.description}>
          The Gaming Account management feature is currently under development. 
          Soon you'll be able to update your gaming credentials and manage your gaming account directly from this page.
        </p>
        <p style={comingSoonStyles.description}>
          We're working hard to bring you this feature as quickly as possible!
        </p>
        <div style={comingSoonStyles.info}>
          <AiOutlineInfoCircle />
          <span>Feature expected to launch in the next update</span>
        </div>
      </div>
    </section>
  );
};

export default GamingSection; 