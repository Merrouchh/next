import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Preconnect to external resources */}
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Zen+Dots&display=swap"
            rel="stylesheet"
          />
          
          {/* PWA Meta Tags */}
          <meta name="theme-color" content="#000000" /> {/* Adjust the color to your app's theme */}
          <link rel="icon" href="/favicon.ico" />
          
          {/* Apple-specific meta tags for PWA */}
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          
          {/* Web App Meta Tags */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="application-name" content="Merrouch" />
          <meta name="apple-mobile-web-app-title" content="Merrouch" />
          <meta name="msapplication-navbutton-color" content="#000000" />
          <meta name="msapplication-starturl" content="/" />
          
          {/* Web App Manifest */}
          <link rel="manifest" href="/manifest.json" />
          <meta httpEquiv="Cross-Origin-Opener-Policy" content="same-origin" />
          <meta httpEquiv="Cross-Origin-Embedder-Policy" content="credentialless" />
          <meta httpEquiv="Cross-Origin-Resource-Policy" content="same-site" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
