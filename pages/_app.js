import { AuthProvider } from "../contexts/AuthContext"; // Adjust the path accordingly
import '../styles/globals.css'; // Import the global styles
import '../pages/avcomputers.css';  // Import your avcomputers.css here
import Head from 'next/head'; // Import Head for meta tags

function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Add the viewport meta tag */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui" />
      </Head>
      
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}

export default MyApp;
