import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/runquest\.veloxisit\.com\.br\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 },
        networkTimeoutSeconds: 8,
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return [
      // Em dev pode-se proxyar /api -> backend. Em prod, nginx faz isso.
      { source: '/api/:path*', destination: `${process.env.API_BASE_URL ?? 'http://localhost:4000/api'}/:path*` },
    ];
  },
};

export default withPWA(nextConfig);
