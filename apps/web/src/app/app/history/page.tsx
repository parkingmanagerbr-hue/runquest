'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatDistance, formatDuration, formatPace } from '@/lib/geo';

interface Run {
  id: string;
  startedAt: string;
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  source: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs?limit=100`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    })
      .then(r => r.json()).then(setRuns)
      .finally(() => setLoading(false));
  }, [router]);

  const totalKm = runs.reduce((a, r) => a + r.distanceMeters / 1000, 0);
  const totalDuration = runs.reduce((a, r) => a + r.durationSec, 0);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Histórico</h1>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        {/* Resumo */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="glass p-5">
            <Activity className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-3xl font-black">{runs.length}</div>
            <div className="text-xs text-white/50">corridas</div>
          </div>
          <div className="glass p-5">
            <TrendingUp className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-3xl font-black">{totalKm.toFixed(1)}</div>
            <div className="text-xs text-white/50">km totais</div>
          </div>
          <div className="glass p-5">
            <Clock className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-3xl font-black tabular-nums">{formatDuration(totalDuration)}</div>
            <div className="text-xs text-white/50">tempo total</div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-white/60">Carregando…</div>
        ) : runs.length === 0 ? (
          <div className="glass p-12 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
            <h2 className="font-display text-xl font-bold mb-2">Sem corridas ainda</h2>
            <p className="text-white/60 mb-6">Inicie sua primeira corrida com GPS no mapa.</p>
            <Link href="/app/run" className="btn-primary inline-flex">Iniciar corrida</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const d = new Date(r.startedAt);
              return (
                <Link key={r.id} href={`/app/runs/${r.id}`}
                  className="glass p-4 flex items-center gap-4 hover:border-rq-lime/30 transition">
                  <div className="text-center w-14 shrink-0">
                    <div className="text-xs text-white/40 uppercase">{d.toLocaleString('pt-BR', { month: 'short' })}</div>
                    <div className="font-display text-2xl font-black leading-none">{d.getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold capitalize truncate">
                      {d.toLocaleDateString('pt-BR', { weekday: 'long' })} · {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex gap-4 text-xs text-white/60 mt-1">
                      <span>{formatDistance(r.distanceMeters)} km</span>
                      <span>{formatDuration(r.durationSec)}</span>
                      <span>{formatPace(r.avgPaceSecPerKm)}/km</span>
                      {r.source !== 'GPS' && <span className="text-rq-orange">{r.source}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
