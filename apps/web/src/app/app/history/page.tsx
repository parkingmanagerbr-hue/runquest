'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Clock, TrendingUp, ChevronRight, MapPin, Download } from 'lucide-react';
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

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function exportCSV(runs: Run[]) {
  const header = 'Data,Distância (km),Duração (min),Pace médio (min/km),Fonte';
  const rows = runs.map(r => {
    const d = new Date(r.startedAt).toISOString().slice(0, 19).replace('T', ' ');
    const km = (r.distanceMeters / 1000).toFixed(2);
    const min = (r.durationSec / 60).toFixed(1);
    const pace = `${Math.floor(r.avgPaceSecPerKm / 60)}:${String(r.avgPaceSecPerKm % 60).padStart(2, '0')}`;
    return `"${d}",${km},${min},"${pace}","${r.source}"`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `runquest-corridas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
      .then(r => r.json()).then(d => setRuns(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [router]);

  const totalKm = runs.reduce((a, r) => a + r.distanceMeters / 1000, 0);
  const totalDuration = runs.reduce((a, r) => a + r.durationSec, 0);
  const avgPace = runs.length > 0
    ? Math.round(runs.reduce((a, r) => a + r.avgPaceSecPerKm, 0) / runs.length)
    : 0;

  // Group runs by month
  const byMonth = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const r of runs) {
      const d = new Date(r.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Sort descending
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [runs]);

  // Monthly volume for sparkline (last 6 months)
  const monthlyKm = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthRuns = runs.filter(r => {
        const rd = new Date(r.startedAt);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      });
      return {
        label: MONTH_LABELS[d.getMonth()],
        km: monthRuns.reduce((a, r) => a + r.distanceMeters / 1000, 0),
        count: monthRuns.length,
      };
    });
  }, [runs]);

  const maxKm = Math.max(...monthlyKm.map(m => m.km), 1);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold">Histórico</h1>
          {runs.length > 0 && (
            <button onClick={() => exportCSV(runs)}
              className="ml-auto flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass p-4">
            <Activity className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-2xl font-black">{runs.length}</div>
            <div className="text-xs text-white/50">corridas</div>
          </div>
          <div className="glass p-4">
            <TrendingUp className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-2xl font-black">{totalKm.toFixed(1)}</div>
            <div className="text-xs text-white/50">km totais</div>
          </div>
          <div className="glass p-4">
            <Clock className="w-4 h-4 text-rq-lime mb-1" />
            <div className="font-display text-lg font-black tabular-nums">{formatDuration(totalDuration)}</div>
            <div className="text-xs text-white/50">tempo total</div>
          </div>
        </div>

        {/* Monthly volume chart */}
        {runs.length > 0 && (
          <div className="glass p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Volume mensal (km)</h2>
            <div className="flex items-end gap-2 h-24">
              {monthlyKm.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] text-white/50 tabular-nums">{m.km > 0 ? m.km.toFixed(0) : ''}</div>
                  <div className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${(m.km / maxKm) * 64}px`,
                      minHeight: m.km > 0 ? '4px' : '0',
                      background: i === monthlyKm.length - 1
                        ? 'linear-gradient(to top, #a3e635, #34d399)'
                        : 'rgba(255,255,255,0.15)',
                    }} />
                  <div className="text-[9px] text-white/40">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Runs grouped by month */}
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
          <div className="space-y-5">
            {byMonth.map(([key, monthRuns]) => {
              const [year, month] = key.split('-');
              const monthKm = monthRuns.reduce((a, r) => a + r.distanceMeters / 1000, 0);
              const monthLabel = `${MONTH_LABELS[parseInt(month) - 1]} ${year}`;
              return (
                <div key={key}>
                  {/* Month header */}
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">{monthLabel}</h2>
                    <div className="flex gap-3 text-xs text-white/40">
                      <span>{monthRuns.length} corrida{monthRuns.length !== 1 ? 's' : ''}</span>
                      <span>{monthKm.toFixed(1)} km</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {monthRuns.map((r) => {
                      const d = new Date(r.startedAt);
                      return (
                        <Link key={r.id} href={`/app/runs/${r.id}`}
                          className="glass p-4 flex items-center gap-4 hover:border-rq-lime/30 transition">
                          <div className="text-center w-10 shrink-0">
                            <div className="text-xs text-white/40">{MONTH_LABELS[d.getMonth()]}</div>
                            <div className="font-display text-xl font-black leading-none">{d.getDate()}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm capitalize truncate">
                              {d.toLocaleDateString('pt-BR', { weekday: 'long' })} · {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-white/60 mt-1">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{formatDistance(r.distanceMeters)} km</span>
                              <span>{formatDuration(r.durationSec)}</span>
                              <span className="text-rq-lime font-mono">{formatPace(r.avgPaceSecPerKm)}/km</span>
                              {r.source !== 'GPS' && <span className="text-rq-orange">{r.source}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
