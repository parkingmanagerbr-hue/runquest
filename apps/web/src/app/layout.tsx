import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'RunQuest — Corra. Conquiste. Evolua.',
  description:
    'App de corrida gamificado: conquiste territórios no mapa, complete missões, evolua com Personal Trainer IA. Disponível como PWA, Android e iOS.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0E0A2A',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'RunQuest' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'RunQuest', siteName: 'RunQuest',
    description: 'Transforme cada corrida em uma quest. Conquiste o mapa.',
    type: 'website', locale: 'pt_BR',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E0A2A',
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
