import { WifiOff } from 'lucide-react';
import Link from 'next/link';

/**
 * Fallback offline: o next-pwa serve esta página quando o usuário navega para
 * uma rota que ainda não está em cache e não há rede. As telas já visitadas
 * continuam abrindo do cache; esta só cobre o caso "primeira vez + sem rede".
 */
export const metadata = { title: 'Offline — RunQuest' };

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-rq-aurora flex items-center justify-center px-6">
      <div className="glass p-10 max-w-sm w-full text-center">
        <WifiOff className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
        <h1 className="font-display text-2xl font-black mb-2">Você está offline</h1>
        <p className="text-white/60 text-sm mb-6">
          Esta tela ainda não foi baixada. As telas que você já abriu continuam
          funcionando sem internet — inclusive gravar uma corrida por GPS, que
          sincroniza sozinha quando a conexão voltar.
        </p>
        <Link href="/app" className="btn-primary inline-flex">Voltar ao início</Link>
      </div>
    </main>
  );
}
