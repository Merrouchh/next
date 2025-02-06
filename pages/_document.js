import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    let metaData = {};
    try {
      // Safely access meta data
      const pageProps = (this.__NEXT_DATA__?.props?.pageProps) || {};
      metaData = pageProps.metaData || {};
    } catch (error) {
      console.error('Error accessing meta data:', error);
    }

    return (
      <Html lang="en">
        <Head>
          {/* Dynamic Meta Tags */}
          {metaData.title ? (
            <>
              <title>{metaData.title}</title>
              <meta property="og:title" content={metaData.title} />
              <meta name="twitter:title" content={metaData.title} />
            </>
          ) : (
            <title>Merrouch Gaming</title>
          )}
          
          {metaData.description && (
            <>
              <meta name="description" content={metaData.description} />
              <meta property="og:description" content={metaData.description} />
              <meta name="twitter:description" content={metaData.description} />
            </>
          )}
          
          {metaData.image && (
            <>
              <meta property="og:image" content={metaData.image} />
              <meta name="twitter:image" content={metaData.image} />
              <meta property="og:image:width" content="1200" />
              <meta property="og:image:height" content="630" />
            </>
          )}
          
          {metaData.url && (
            <>
              <meta property="og:url" content={metaData.url} />
              <link rel="canonical" href={metaData.url} />
            </>
          )}
          
          {metaData.type && (
            <meta property="og:type" content={metaData.type || 'website'} />
          )}

          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@merrouchgaming" />
          <meta property="og:site_name" content="Merrouch Gaming" />
          
          {/* Static Meta Tags */}
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Zen+Dots&display=swap" rel="stylesheet" />
          
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
          
          {/* Business Info */}
          <meta property="business:contact_data:street_address" content="RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1" />
          <meta property="business:contact_data:locality" content="Tangier" />
          <meta property="business:contact_data:postal_code" content="90060" />
          <meta property="business:contact_data:country_name" content="Morocco" />
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
