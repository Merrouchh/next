/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode only in development
  reactStrictMode: true,
  
  // Ensure trailing slash consistency
  trailingSlash: false,
  
  // Ensure proper asset handling
  generateEtags: true,
  poweredByHeader: false,
  compress: true,
  
  // Force consistent build IDs and prevent caching issues
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  
  // Add version query parameter to force cache invalidation
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
  
  // Disable automatic static optimization to ensure fresh HTML
  target: 'server',

  // Disable error overlay in development
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    VIDEO_OPTIMIZER_URL: process.env.VIDEO_OPTIMIZER_URL,
    // Disable the overlay in development
    NEXT_PUBLIC_DISABLE_ERROR_OVERLAY: 'true',
    // Expose build ID for automatic cache invalidation
    NEXT_PUBLIC_BUILD_ID: 'build-' + Date.now(),
  },

  // Image optimization settings
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_HOSTNAME || 'qdbtccrhcidxllycuxnw.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com'
      }
    ],
    // Only allow SVG from trusted sources
    dangerouslyAllowSVG: false,
    domains: ['merrouchgaming.com'],
  },

  // ESLint configuration
  eslint: {
    // Don't ignore during builds - let's fix the errors instead
    ignoreDuringBuilds: false,
    dirs: ['pages', 'components', 'lib', 'utils', 'contexts']
  },

  // Compiler options
  compiler: {
    // Keep React properties in development
    reactRemoveProperties: process.env.NODE_ENV === 'production',
    // Enable console removal in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Webpack configuration
  webpack: (config, { isServer, dev }) => {
    config.infrastructureLogging = { level: 'error' };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        punycode: false,
      };
    }

    // Only in production client bundle
    if (!isServer && !dev) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        // Disable framework chunk
        framework: false
      };
    }

    return config;
  },

  // URL rewrites
  async rewrites() {
    return [
      {
        source: '/storage/highlight-clips/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/:path*`,
      }
    ];
  },

  // Security headers with more restrictive CORS
  async headers() {
    return [
      {
        // Static assets need proper caching and MIME types
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      },
      {
        // JavaScript and CSS files
        source: '/:path*.(js|css|woff|woff2|eot|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        // Apply no-cache to HTML pages only (not static assets)
        source: '/((?!_next/static|favicon.ico|robots.txt|sitemap.xml).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding, User-Agent'
          },
          {
            key: 'Last-Modified',
            value: new Date().toUTCString()
          },
          {
            key: 'ETag',
            value: `"${Date.now()}"`
          }
        ]
      },
      {
        // Specific stricter rules for dashboard
        source: '/dashboard',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ]
      },
      {
        // Specific stricter rules for avcomputers
        source: '/avcomputers',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store'
          }
        ]
      },
      {
        // Specific caching rules for discover page
        source: '/discover',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300'
          },
          {
            key: 'Surrogate-Control',
            value: 'public, max-age=60, stale-while-revalidate=300'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      },
      {
        // Specific caching rules for individual clip pages
        source: '/clip/:id',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=600'
          },
          {
            key: 'Surrogate-Control',
            value: 'public, max-age=60, stale-while-revalidate=600'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Vary',
            value: 'Cookie'
          }
        ]
      },
      {
        // Profile pages cache control
        source: '/profile/:username',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=10, stale-while-revalidate=59'
          },
          {
            key: 'Vary',
            value: 'Cookie, Authorization'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      },
      {
        // Top users page cache control
        source: '/topusers',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=15, stale-while-revalidate=30'
          },
          {
            key: 'Surrogate-Control',
            value: 'public, max-age=15, stale-while-revalidate=30'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding'
          }
        ]
      },
      {
        // Home page cache control (more aggressive caching for landing page)
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=3600'
          },
          {
            key: 'Surrogate-Control',
            value: 'public, max-age=300, stale-while-revalidate=3600'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Vary',
            value: 'Cookie, Accept-Encoding'
          }
        ]
      },
      {
        // Shop page cache control
        source: '/shop',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300'
          },
          {
            key: 'Surrogate-Control',
            value: 'public, max-age=60, stale-while-revalidate=300'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Vary',
            value: 'Cookie, Accept-Encoding'
          }
        ]
      },
      {
        source: '/service-worker.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          }
        ]
      }
    ];
  },



  // Add this section
  experimental: {
    scrollRestoration: true,
    // Only apply forceSwcTransforms when not using Turbopack
    ...(process.env.TURBOPACK !== '1' && {
      forceSwcTransforms: true,
    }),
  },

  // TypeScript and ESLint - Only ignore in production


  // Development features
  ...(process.env.NODE_ENV === 'production' && {
    // Remove deprecated config
  })
};

// Validate required environment variables
const requiredEnvs = ['VIDEO_OPTIMIZER_URL'];
for (const env of requiredEnvs) {
  if (!process.env[env]) {
    throw new Error(`${env} environment variable is required`);
  }
}

// Add proper error handling for process events
['SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection'].forEach(signal => {
  process.on(signal, (error) => {
    console.error(`Received ${signal}${error ? ': ' + error : ''}. Performing cleanup...`);
    // Add any cleanup logic here
    process.exit(signal === 'uncaughtException' ? 1 : 0);
  });
});

module.exports = nextConfig;