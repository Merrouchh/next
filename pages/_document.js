import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => App,
          enhanceComponent: (Component) => Component,
        });

      const initialProps = await Document.getInitialProps(ctx);
      return { ...initialProps };
    } catch (error) {
      return { ...await Document.getInitialProps(ctx) };
    }
  }

  render() {
    let metaData = {};
    try {
      metaData = this.props.__NEXT_DATA__.props.pageProps?.metaData || {};
    } catch (error) {
      // Silently fail and use defaults
    }

    return (
      <Html lang="en">
        <Head>
          {/* Force meta tags to be rendered */}
          <meta property="og:title" content={metaData.title || 'Merrouch Gaming'} key="og:title" />
          <meta property="og:description" content={metaData.description || 'Gaming Center in Tangier'} key="og:description" />
          <meta property="og:image" content={metaData.image || 'https://merrouchgaming.com/top.jpg'} key="og:image" />
          <meta property="og:url" content={metaData.url || 'https://merrouchgaming.com'} key="og:url" />
          <meta property="og:type" content={metaData.type || 'website'} key="og:type" />
          
          <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
          <meta name="twitter:site" content="@merrouchgaming" key="twitter:site" />
          <meta name="twitter:title" content={metaData.title || 'Merrouch Gaming'} key="twitter:title" />
          <meta name="twitter:description" content={metaData.description || 'Gaming Center in Tangier'} key="twitter:description" />
          <meta name="twitter:image" content={metaData.image || 'https://merrouchgaming.com/top.jpg'} key="twitter:image" />
          
          <meta property="og:site_name" content="Merrouch Gaming" key="og:site_name" />

          {/* Static Resources with correct 'as' attributes */}
          <link 
            rel="stylesheet" 
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
            as="style"
          />
          <link 
            rel="preconnect" 
            href="https://fonts.googleapis.com" 
            crossOrigin="anonymous"
          />
          <link 
            rel="preconnect" 
            href="https://fonts.gstatic.com" 
            crossOrigin="anonymous"
          />
          <link 
            href="https://fonts.googleapis.com/css2?family=Zen+Dots&display=swap" 
            rel="stylesheet"
            as="style"
          />
          
          {/* PWA with correct 'as' attributes */}
          <link 
            rel="icon" 
            href="/favicon.ico" 
            as="image"
          />
          <link 
            rel="manifest" 
            href="/manifest.json" 
            as="fetch"
            crossOrigin="use-credentials"
          />
          <link 
            rel="apple-touch-icon" 
            href="/apple-touch-icon.png" 
            as="image"
          />
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

          {/* Add Media Chrome */}
          <script 
            type="module" 
            src="https://cdn.jsdelivr.net/npm/media-chrome@1.5.1/+esm"
            strategy="beforeInteractive"
          />
          
          {/* Add HLS Video Element */}
          <script 
            type="module" 
            src="https://cdn.jsdelivr.net/npm/hls-video-element@1.2/+esm"
            strategy="beforeInteractive"
          />
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
