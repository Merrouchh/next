/** @type {import('next').NextConfig} */
// Only load bundle analyzer when specifically requested
let withBundleAnalyzer = (config) => config;
if (process.env.ANALYZE === 'true') {
  try {
    withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: true,
    });
  } catch (error) {
    console.warn('Bundle analyzer not available:', error.message);
  }
}

const nextConfig = {
  // Enable React strict mode only in development
  reactStrictMode: true,

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
    // Optimize image loading
    minimumCacheTTL: 31536000,
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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

  // Simplified webpack configuration
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

    // Conservative performance optimizations
    if (!dev) {
      // Only modify splitChunks, avoid touching other optimization settings
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          framerMotion: {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'framer-motion',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
          videojs: {
            test: /[\\/]node_modules[\\/]video\.js[\\/]/,
            name: 'videojs',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
        },
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

  // Security headers (cache rules removed)
  async headers() {
    return [
      {
        // Basic security headers for all pages
        source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      },
      {
        // Cache static assets for 1 year
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
      // Note: Static asset caching (images, fonts) is handled by Cloudflare _headers file
      // to avoid regex pattern conflicts with Next.js header source parsing
    ];
  },

  // Security optimizations
  poweredByHeader: false,
  generateEtags: true,
  compress: true,

  // Add this section
  experimental: {
    scrollRestoration: true,
    // Only apply forceSwcTransforms when not using Turbopack
    ...(process.env.TURBOPACK !== '1' && {
      forceSwcTransforms: true,
    }),
    // Conservative optimizations - only icon tree shaking
    modularizeImports: {
      '@react-icons/md': {
        transform: '@react-icons/md/{{member}}',
      },
      '@react-icons/fa': {
        transform: '@react-icons/fa/{{member}}',
      },
      '@react-icons/ai': {
        transform: '@react-icons/ai/{{member}}',
      },
    },
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

module.exports = withBundleAnalyzer(nextConfig);