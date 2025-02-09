import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { Inter, Orbitron } from 'next/font/google';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
});

function MyApp({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Layout>
          <main className={`${inter.variable} ${orbitron.variable}`}>
            <Component {...pageProps} />
          </main>
        </Layout>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp;