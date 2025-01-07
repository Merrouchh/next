/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'merrouchgaming.com',
        pathname: '/**', // This allows loading images from any path under the domain
      },
    ],
  },
}

module.exports = nextConfig
