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
          
          {/* Add these new meta tags */}
          <meta name="geo.region" content="MA-01" />
          <meta name="geo.placename" content="Tangier" />
          <meta name="geo.position" content="35.768787;-5.8102713" />
          <meta name="ICBM" content="35.768787, -5.8102713" />
          <meta name="revisit-after" content="1 days" />
          <meta name="google" content="notranslate" />
          
          {/* Add language alternates */}
          <link rel="alternate" hrefLang="x-default" href="https://merrouchgaming.com" />
          
          {/* Add social media verification */}
          <meta name="facebook-domain-verification" content="dxu3ycwpdg2uorgckvuv8kwr3ci661" />
          
          {/* Local Business Tags */}
          <meta name="business:contact_data:street_address" content="RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1" />
          <meta name="business:contact_data:locality" content="Tangier" />
          <meta name="business:contact_data:postal_code" content="90060" />
          <meta name="business:contact_data:country_name" content="Morocco" />
          <meta name="business:contact_data:phone_number" content="+212531098983" />
          
          {/* Open Graph Business Info */}
          <meta property="og:type" content="business.business" />
          <meta property="business:contact_data:street_address" content="RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1" />
          <meta property="business:contact_data:locality" content="Tangier" />
          <meta property="business:contact_data:region" content="Tanger-Tetouan-Al Hoceima" />
          <meta property="business:contact_data:postal_code" content="90060" />
          <meta property="business:contact_data:country_name" content="Morocco" />
          <meta property="place:location:latitude" content="35.768787" />
          <meta property="place:location:longitude" content="-5.8102713" />
          
          {/* Rich Snippets */}
          <meta name="description" content="Premium Gaming Center in Tangier with RTX 3070 PCs, 200Mbps internet, and competitive gaming environment. Best cyber café gaming à Tanger. أفضل مقهى ألعاب في طنجة" />
          <meta name="keywords" content="gaming center tangier, cyber cafe tanger, gaming cafe morocco, pc gamer tanger, RTX 3070 gaming, esports tangier, internet cafe near me, cyber gaming tanger, salle de jeux tanger, قاعة العاب طنجة, مقهى الألعاب في طنجة" />
          
          {/* Social Media */}
          <meta property="og:title" content="Cyber Merrouch Gaming Center - Best Gaming Center in Tangier" />
          <meta property="og:description" content="High-end gaming PCs with RTX 3070, 200Mbps internet, competitive gaming environment. Gaming café près de vous à Tanger." />
          <meta property="og:image" content="https://merrouchgaming.com/top.jpg" />
          <meta property="og:url" content="https://merrouchgaming.com" />
          
          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Cyber Merrouch Gaming Center - Tangier" />
          <meta name="twitter:description" content="Premium Gaming Center with RTX 3070 PCs and 200Mbps internet. Best gaming experience in Tangier." />
          <meta name="twitter:image" content="https://merrouchgaming.com/top.jpg" />
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
