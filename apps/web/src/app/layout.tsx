import './globals.css';
import type { Metadata, Viewport } from 'next';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'RunQuest — Corra. Conquiste. Evolua.',
  description:
    'App de corrida gamificado: conquiste territórios no mapa, complete missões, evolua com Personal Trainer IA. Disponível como PWA, Android e iOS.',
  manifest: '/manifest.webmanifest',
  themeColor: '#000000',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'RunQuest' },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/favicon-32.png',
  },
  openGraph: {
    title: 'RunQuest', siteName: 'RunQuest',
    description: 'Transforme cada corrida em uma quest. Conquiste o mapa.',
    type: 'website', locale: 'pt_BR',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-body antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
