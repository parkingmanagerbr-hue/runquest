'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPinned, Trophy, Clock } from 'lucide-react';
import { api, tokens } from '@/lib/api';

const TerritoryMap = dynamic(() => import('@/components/TerritoryMap').then(m => m.TerritoryMap), {
  ssr: false,
  loading: () => <div className="h-[60vh] bg-rq-night animate-pulse rounded-2xl" />,
});

interface Territory {
  h3: string;
  visits: number;
  captured: boolean;
  capturedAt: string | null;
  expiresAt: string;
  boundary: [number, number][];
}

export default function TerritoriesPage() {
  const router = useRouter();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [stats, setStats] = useState<{ total: number; captured: number; contested: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    Promise.all([
      api.get<Territory[]>('/territories/me'),
      api.get<{ total: number; captured: number; contested: number }>('/territories/stats'),
    ]).then(([list, s]) => {
      setTerritories(list);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Territórios</h1>
          <MapPinned className="w-4 h-4 text-rq-lime ml-auto" />
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="glass p-4 text-center">
              <Trophy className="w-4 h-4 text-rq-lime mx-auto mb-1" />
              <div className="font-display text-3xl font-black">{stats.captured}</div>
              <div className="text-xs text-white/50">conquistados</div>
            </div>
            <div className="glass p-4 text-center">
              <Clock className="w-4 h-4 text-rq-gold mx-auto mb-1" />
              <div className="font-display text-3xl font-black">{stats.contested}</div>
              <div className="text-xs text-white/50">em disputa</div>
            </div>
            <div className="glass p-4 text-center">
              <MapPinned className="w-4 h-4 text-rq-violet mx-auto mb-1" />
              <div className="font-display text-3xl font-black">{stats.total}</div>
              <div className="text-xs text-white/50">células visitadas</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-white/60">Carregando…</div>
        ) : territories.length === 0 ? (
          <div className="glass p-12 text-center">
            <MapPinned className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
            <h2 className="font-display text-xl font-bold mb-2">Sem territórios ainda</h2>
            <p className="text-white/60 mb-6">
              Corra pra capturar hexágonos no mapa. <br />
              <strong>3 visitas</strong> na mesma célula = conquistado.
            </p>
            <Link href="/app/run" className="btn-primary inline-flex">Iniciar corrida</Link>
          </div>
        ) : (
          <>
            <TerritoryMap territories={territories} height="60vh" />
            <div className="glass p-5 text-sm">
              <h3 className="font-bold mb-2">Como funciona</h3>
              <ul className="space-y-1 text-white/60">
                <li>🟡 <strong className="text-rq-gold">Amarelo:</strong> contestado (1-2 visitas)</li>
                <li>🟢 <strong className="text-rq-lime">Verde:</strong> conquistado (3+ visitas)</li>
                <li>⏱️ Cada visita estende a expiração para mais 21 dias</li>
                <li>📏 Cada célula tem ~150m de largura (H3 resolução 9)</li>
              </ul>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
