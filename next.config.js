/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'qdbtccrhcidxllycuxnw.supabase.co', // Your Supabase project URL
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', ''), // Dynamic Supabase URL
      'unpkg.com' // For FFmpeg resources
    ].filter(Boolean),
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
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
            value: 'same-site'
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS'
          }
        ]
      }
    ];
  },
  webpack: (config, { isServer }) => {
    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add FFmpeg module resolution
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
}

module.exports = nextConfig
