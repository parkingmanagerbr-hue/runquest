import withPWAInit from 'next-pwa';
import { fileURLToPath } from 'url';
import path from 'path';

// Raiz do monorepo — no Next 15, sem isto o file-tracing do output standalone
// infere a raiz errada (há lockfile na raiz E em apps/web) e avisa.
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
  async rewrites() {
    return [
      // Em dev pode-se proxyar /api -> backend. Em prod, nginx faz isso.
      { source: '/api/:path*', destination: `${process.env.API_BASE_URL ?? 'http://localhost:4000/api'}/:path*` },
    ];
  },
};

export default withPWA(nextConfig);
