import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Layout from '../components/Layout';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp;