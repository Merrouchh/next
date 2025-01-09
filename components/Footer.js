import styles from '../styles/Footer.module.css';
import { AiOutlineInstagram, AiOutlinePhone, AiOutlineEnvironment } from 'react-icons/ai';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.section}>
            <h3>Contact Us</h3>
            <div className={styles.contactInfo}>
              <p>
                <AiOutlinePhone className={styles.icon} />
                0531098983
              </p>
              <p>
                <AiOutlineEnvironment className={styles.icon} />
                Avenue Abi Elhassan Chadili, Tangier
              </p>
              <p>
                <AiOutlineInstagram className={styles.icon} />
                <a 
                  href="https://instagram.com/merrouchgaming" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  @merrouchgaming
                </a>
              </p>
            </div>
          </div>
          
          <div className={styles.section}>
            <h3>Opening Hours</h3>
            <p>Monday - Sunday</p>
            <p>10:00 AM - 12:00 AM</p>
          </div>
        </div>
        
        <div className={styles.copyright}>
          <p>© {new Date().getFullYear()} Merrouch Gaming. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 