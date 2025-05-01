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
          {/* Removed Zen Dots link - now loaded with next/font in _app.js */}
          
          {/* PWA */}
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <meta name="application-name" content="Merrouch" />
          <meta name="apple-mobile-web-app-title" content="Merrouch" />
          
          {/* Error overlay disabler for auth errors - run early */}
          {process.env.NODE_ENV === 'development' && (
            <script 
              dangerouslySetInnerHTML={{ 
                __html: `
                  window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
                  window.__NEXT_DATA__.nextExport = true;
                  
                  // Disable error overlay for specific errors
                  const originalError = console.error;
                  console.error = (...args) => {
                    if (
                      args[0] && 
                      typeof args[0] === 'string' && 
                      (args[0].includes('AuthApiError') || 
                       args[0].includes('Invalid login credentials') ||
                       args[0].includes('Current password is incorrect') ||
                       args[0].includes('verification code') ||
                       args[0].includes('Invalid verification code'))
                    ) {
                      // Don't log these specific errors to console
                      return;
                    }
                    return originalError.apply(console, args);
                  };
                  
                  // Intercept error events
                  window.addEventListener('error', function(event) {
                    if (
                      event.error && 
                      (event.error.name === 'AuthApiError' || 
                       (event.error.message && (
                         event.error.message.includes('Invalid login credentials') ||
                         event.error.message.includes('Current password is incorrect') ||
                         event.error.message.includes('verification code') ||
                         event.error.message.includes('Invalid verification code'))))
                    ) {
                      event.preventDefault();
                      return false;
                    }
                  }, true);
                  
                  // Intercept unhandled promise rejections
                  window.addEventListener('unhandledrejection', function(event) {
                    if (
                      event.reason && 
                      (event.reason.name === 'AuthApiError' || 
                       (event.reason.message && (
                         event.reason.message.includes('Invalid login credentials') ||
                         event.reason.message.includes('Current password is incorrect') ||
                         event.reason.message.includes('verification code') ||
                         event.reason.message.includes('Invalid verification code'))))
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      console.debug("Suppressed error:", event.reason.message);
                      return false;
                    }
                  }, true);
                  
                  // Special handler specifically for verification code errors
                  const origCatchErrors = window.__NEXT_PROMISE_REJECTION_HANDLER__;
                  window.__NEXT_PROMISE_REJECTION_HANDLER__ = function(err) {
                    if (
                      err && 
                      typeof err.message === 'string' && 
                      (err.message.includes('verification code') || 
                       err.message.includes('Invalid verification code'))
                    ) {
                      // Completely suppress Next.js from handling these errors
                      console.debug("Next.js rejection handler suppressed error:", err.message);
                      return false;
                    }
                    return origCatchErrors ? origCatchErrors(err) : false;
                  };
                `
              }} 
            />
          )}
          
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
          <script dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof window !== 'undefined') {
                    // Look for magic link hash in the URL
                    const hash = window.location.hash;
                    if (hash && 
                        hash.includes('access_token=') && 
                        hash.includes('refresh_token=') &&
                        window.location.pathname !== '/magic-login') {
                      
                      console.log('Detected magic link with hash length:', hash.length);
                      
                      // Get the origin (protocol + hostname + port)
                      const origin = window.location.origin;
                      
                      // Redirect to our magic-login handler
                      console.log('Redirecting to magic login page');
                      window.location.href = origin + '/magic-login' + hash;
                    }
                  }
                } catch (e) {
                  console.error('Error in magic link detection script:', e);
                }
              })();
            `
          }} />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
