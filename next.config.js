/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode only in development
  reactStrictMode: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    // Reduce cache duration to 1 month for more frequent updates
    minimumCacheTTL: 2592000, // 30 days
    domains: ['merrouchgaming.com'],
    // Add reasonable image size limits
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [110, 220, 384], // Match your logo sizes
    formats: ['image/webp', 'image/avif'],  // Modern formats
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
  webpack: (config) => {
    config.infrastructureLogging = { level: 'error' };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

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
      },
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap',
      },
    ];
  },

  // Security headers with more restrictive CORS
  async headers() {
    return [
      // Global headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      // Specific headers for video streaming
      {
        source: '/storage/highlight-clips/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400'
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes'
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Range, Accept-Ranges'
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'Content-Range, Content-Length'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          }
        ]
      }
    ];
  },

  // Security optimizations
  poweredByHeader: false,
  generateEtags: true,
  compress: true,

  // Add this section
  experimental: {
    scrollRestoration: true,
    forceSwcTransforms: true,
  },

  // Add proper process handling
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 120 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },

  // TypeScript and ESLint - Only ignore in production


  // Development features
  ...(process.env.NODE_ENV === 'production' && {
    devIndicators: {
      buildActivity: true,
    }
  })
};

// Add proper error handling for process events
['SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection'].forEach(signal => {
  process.on(signal, (error) => {
    console.error(`Received ${signal}${error ? ': ' + error : ''}. Performing cleanup...`);
    // Add any cleanup logic here
    process.exit(signal === 'uncaughtException' ? 1 : 0);
  });
});

module.exports = nextConfig;