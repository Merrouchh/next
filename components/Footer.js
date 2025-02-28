import styles from '../styles/Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <p>&copy; 2025 Merrouch Gaming. All rights reserved.</p>
      <p>Contact us: admin@merrouchgaming.com</p>
      <p>Follow us on social media:</p>
      <p>
        <a href="https://facebook.com/merrouchgaming" target="_blank" rel="noopener noreferrer">Facebook</a> | 
        <a href="https://instagram.com/merrouchgaming" target="_blank" rel="noopener noreferrer">Instagram</a>
      </p>
    </footer>
  );
};

export default Footer; 