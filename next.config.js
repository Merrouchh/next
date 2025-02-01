/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode only in development for better debugging
  reactStrictMode: process.env.NODE_ENV === 'development',

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
        hostname: 'qdbtccrhcidxllycuxnw.supabase.co'
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com'
      }
    ],
    dangerouslyAllowSVG: true,
    minimumCacheTTL: 60,
  },

  // Compiler options
  compiler: {
    // Enable console removal in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Optimize logging
    config.infrastructureLogging = { level: 'error' };

    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Optimize fallbacks
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Handle WebSocket-related externals
    config.externals = [
      ...(config.externals || []).filter(e => 
        e !== 'bufferutil' && 
        e !== 'utf-8-validate'
      ),
      { 'bufferutil': 'bufferutil' },
      { 'utf-8-validate': 'utf-8-validate' }
    ];

    // Worker configuration
    if (!isServer) {
      config.module.rules.push({
        test: /\.worker\.(js|ts)$/,
        loader: 'worker-loader',
        options: {
          filename: 'static/[hash].worker.js',
          publicPath: '/_next/',
        },
      });
    }

    return config;
  },

  // URL rewrites
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap',
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        // API routes headers
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      {
        // Global security headers
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          },
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
          }
        ],
      },
    ];
  },

  // Performance optimizations
  poweredByHeader: false,
  generateEtags: true,
  compress: true,
};

module.exports = nextConfig;
