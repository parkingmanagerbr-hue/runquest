import withPWAInit from 'next-pwa';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Raiz do monorepo — no Next 15, sem isto o file-tracing do output standalone
// infere a raiz errada (há lockfile na raiz E em apps/web) e avisa.
// SÓ vale quando o build roda DENTRO do monorepo: no Docker o app vive sozinho
// em /app, e apontar o tracing root para /app/../.. (= /) aninha o server.js em
// standalone/app/ — o CMD `node server.js` não o encontra e o container morre
// em crash-loop (502 em produção). Detecta pelo pnpm-workspace.yaml.
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const inMonorepo = fs.existsSync(path.join(monorepoRoot, 'pnpm-workspace.yaml'));

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Fallback servido quando o usuário navega p/ uma rota fora do cache e sem rede.
  fallbacks: { document: '/offline' },
  runtimeCaching: [
    {
      // API: rede primeiro (dado fresco), mas serve do cache quando offline —
      // é o que permite ver corridas/missões já carregadas sem conexão.
      urlPattern: /\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 8,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Chunks do Next (JS/CSS hasheados e imutáveis) — CacheFirst: a casca do
      // app abre offline depois da 1ª carga.
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\/_next\/data\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'next-data', expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 } },
    },
    {
      // Navegações (páginas HTML): serve a última versão cacheada quando offline.
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-resources', expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/i,
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
  ...(inMonorepo ? { outputFileTracingRoot: monorepoRoot } : {}),
  poweredByHeader: false,
  async rewrites() {
    return [
      // Em dev pode-se proxyar /api -> backend. Em prod, nginx faz isso.
      { source: '/api/:path*', destination: `${process.env.API_BASE_URL ?? 'http://localhost:4000/api'}/:path*` },
    ];
  },
};

export default withPWA(nextConfig);
