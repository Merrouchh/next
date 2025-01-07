import Header from './Header';
import styles from '../styles/Layout.module.css';

export default function Layout({ children }) {
  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.main}>{children}</div>
      <footer className={styles.footer}>
        <p>Created By <span className={styles.highlight}>Merrouch</span></p>
      </footer>
    </div>
  );
}