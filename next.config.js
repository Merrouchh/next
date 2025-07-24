/** @type {import('next').NextConfig} */

// Simple, clean Next.js configuration - no Turbopack
const nextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    VIDEO_OPTIMIZER_URL: process.env.VIDEO_OPTIMIZER_URL,
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
    domains: ['merrouchgaming.com'],
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['pages', 'components', 'lib', 'utils', 'contexts']
  },

  // Standard webpack configuration - no Turbopack
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

    // Remove console logs in production builds
    if (!dev) {
      // Find TerserPlugin in optimization.minimizer
      if (config.optimization && config.optimization.minimizer) {
        config.optimization.minimizer.forEach(plugin => {
          if (plugin.constructor.name === 'TerserPlugin') {
            if (!plugin.options.terserOptions) {
              plugin.options.terserOptions = {};
            }
            if (!plugin.options.terserOptions.compress) {
              plugin.options.terserOptions.compress = {};
            }
            // Remove console logs but keep console.error for critical errors
            plugin.options.terserOptions.compress.drop_console = true;
            plugin.options.terserOptions.compress.pure_funcs = [
              'console.log',
              'console.info', 
              'console.debug',
              'console.warn'
            ];
          }
        });
      }
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

  // Headers for cache control - no cache for pages, allow Next.js to handle its own assets  
  async headers() {
    return [
      {
        source: '/((?!_next).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
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
      }
    ];
  },

  // Security optimizations
  poweredByHeader: false,
  generateEtags: false,
  compress: true,

  // Remove console logs in production builds (Next.js built-in feature)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error'] // Keep console.error for critical debugging
    } : false,
  },

  // Experimental features - minimal and safe
  experimental: {
    scrollRestoration: true,
  },
};

// Validate required environment variables
const requiredEnvs = ['VIDEO_OPTIMIZER_URL'];
for (const env of requiredEnvs) {
  if (!process.env[env]) {
    throw new Error(`${env} environment variable is required`);
  }
}

module.exports = nextConfig;