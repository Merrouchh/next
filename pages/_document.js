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
          <meta name="theme-color" content="#000000" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          
          {/* PWA Settings */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <meta name="application-name" content="Merrouch" />
          <meta name="apple-mobile-web-app-title" content="Merrouch" />
          <meta name="msapplication-navbutton-color" content="#000000" />
          <meta name="msapplication-starturl" content="/" />
          
          {/* Business Info - Keep these static */}
          <meta property="business:contact_data:street_address" content="RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1" />
          <meta property="business:contact_data:locality" content="Tangier" />
          <meta property="business:contact_data:postal_code" content="90060" />
          <meta property="business:contact_data:country_name" content="Morocco" />
          <meta property="place:location:latitude" content="35.768787" />
          <meta property="place:location:longitude" content="-5.8102713" />
          
          {/* Remove all OpenGraph and dynamic meta tags from here */}
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
