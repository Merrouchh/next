/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode only in development for better debugging
  reactStrictMode: false,

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
    domains: ['merrouchgaming.com'],
    // Add reasonable image size limits
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compiler options
  compiler: {
    // Enable console removal in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
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
      punycode: false,
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

    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      };
    }

    // Add handling for both .js and .ts files
    config.resolve.extensions = ['.js', '.ts', '.tsx', ...config.resolve.extensions];

    if (dev && !isServer) {
      config.infrastructureLogging = {
        level: 'error'
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      'hls.js': 'hls.js/dist/hls.min.js',
    };

    config.module.rules.push({
      test: /\.(m3u8)$/,
      type: 'asset/resource',
    });

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
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
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
            value: 'X-Requested-With, Content-Type, Authorization, apikey'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          }
        ]
      },
      {
        source: '/storage/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes'
          },
          {
            key: 'Content-Range',
            value: 'bytes'
          }
        ]
      }
    ];
  },

  // Performance optimizations
  poweredByHeader: false,
  generateEtags: true,
  compress: true,

  // Add this section
  experimental: {
    forceSwcTransforms: true,
    scrollRestoration: true,
  },

  // Add proper process handling
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 120 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true
  },
};

// Add proper process handling
if (process.env.NODE_ENV === 'development') {
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Performing cleanup...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT. Performing cleanup...');
    process.exit(0);
  });
}

module.exports = nextConfig;
