'use client';
import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { ToastProvider } from './Toast';
import { isImmersive } from '@/lib/nav';

/**
 * Envolve todas as telas de /app. Provê o sistema de toast/confirm, adiciona o
 * respiro inferior para o conteúdo não ficar atrás da BottomNav e esconde a
 * barra nas telas imersivas. É client porque precisa do pathname; o layout
 * (server) só a renderiza.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const immersive = isImmersive(pathname);

  return (
    <ToastProvider>
      <div className={immersive ? undefined : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'}>
        {children}
        {!immersive && <BottomNav pathname={pathname} />}
      </div>
    </ToastProvider>
  );
}
