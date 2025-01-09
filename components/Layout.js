import Head from 'next/head';
import Header from './Header';
import Footer from './Footer';
import styles from '../styles/Layout.module.css';
import { useAuth } from '../contexts/AuthContext';
import PageTransition from './PageTransition';

const Layout = ({ children }) => {
  const { isLoggedIn } = useAuth();

  return (
    <div className={styles.wrapper}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <PageTransition />
      <Header />
      <main className={styles.main}>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
