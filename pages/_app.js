import { AuthProvider } from "../contexts/AuthContext"; // Adjust the path accordingly
import '../styles/globals.css'; // Import the global styles
import '../pages/avcomputers.css';  // Import your avcomputers.css here

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;

