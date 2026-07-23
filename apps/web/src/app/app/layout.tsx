import { AppChrome } from '@/components/AppChrome';

/**
 * Layout do grupo /app: injeta a navegação inferior persistente em todas as
 * telas autenticadas sem tocar em cada página individualmente.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppChrome>{children}</AppChrome>;
}
