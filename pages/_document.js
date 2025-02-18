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
    return (
      <Html lang="en">
        <Head>
          {/* Keep only the essential meta tags and resources */}
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
          />
          
          {/* PWA */}
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <meta name="application-name" content="Merrouch" />
          <meta name="apple-mobile-web-app-title" content="Merrouch" />
          
          {/* Media Chrome and HLS */}
          <script 
            type="module" 
            src="https://cdn.jsdelivr.net/npm/media-chrome@1.5.1/+esm"
            strategy="beforeInteractive"
          />
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
