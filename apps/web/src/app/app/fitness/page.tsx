'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Trophy, Activity } from 'lucide-react';
import { tokens } from '@/lib/api';
import { computeFitnessTrend, type FitnessTrend } from '@/lib/fitnessTrend';
import type { RunLite } from '@/lib/trainingPaces';

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

function fmt5k(sec: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const VERDICT: Record<FitnessTrend['trend'], { label: string; color: string; icon: any; note: string }> = {
  improving: { label: 'Você está evoluindo', color: 'text-rq-lime', icon: TrendingUp, note: 'Seu 5K estimado vem caindo — o treino está pegando. 🚀' },
  flat: { label: 'Forma estável', color: 'text-cyan-300', icon: Minus, note: 'Manutenção. Para evoluir, adicione qualidade (tiros/tempo) ou volume gradual.' },
  declining: { label: 'Forma em queda', color: 'text-rq-orange', icon: TrendingDown, note: 'Ritmo caindo — pode ser fadiga acumulada. Considere uma semana leve.' },
  insufficient: { label: 'Dados insuficientes', color: 'text-white/60', icon: Activity, note: 'Corra em algumas semanas diferentes para revelar sua tendência.' },
};

export default function FitnessPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${API}/runs?limit=200`, { headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const arr = Array.isArray(d) ? d : (d?.items ?? []);
        setRuns(arr.map((r: any) => ({ distanceMeters: r.distanceMeters, durationSec: r.durationSec, startedAt: r.startedAt })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const now = useMemo(() => Date.now(), []);
  const trend = useMemo(() => computeFitnessTrend(runs, now, 12), [runs, now]);
  const v = VERDICT[trend.trend];

  // Sparkline do 5K estimado (invertido: mais rápido = mais alto)
  const spark = useMemo(() => {
    const pts = trend.weeks.map((w, i) => ({ i, y: w.est5kSec })).filter((p): p is { i: number; y: number } => p.y != null);
    if (pts.length < 2) return null;
    const W = 300, H = 70, pad = 6;
    const ys = pts.map((p) => p.y);
    const minY = Math.min(...ys), maxY = Math.max(...ys), span = maxY - minY || 1;
    const n = trend.weeks.length - 1 || 1;
    const path = pts.map((p, k) => {
      const x = pad + (p.i / n) * (W - 2 * pad);
      const y = pad + ((p.y - minY) / span) * (H - 2 * pad); // maior sec (mais lento) = mais baixo? invertemos: mais rápido = topo
      return `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${(H - y).toFixed(1)}`;
    }).join(' ');
    const last = pts[pts.length - 1];
    const lx = pad + (last.i / n) * (W - 2 * pad);
    const ly = H - (pad + ((last.y - minY) / span) * (H - 2 * pad));
    return { path, W, H, lx, ly };
  }, [trend]);

  const maxKm = Math.max(1, ...trend.weeks.map((w) => w.km));

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rq-lime" /> Evolução de Forma
          </h1>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="text-white/60">Analisando suas corridas…</div>
        ) : (
          <>
            {/* Veredito */}
            <div className="glass p-5">
              <div className="flex items-center gap-3 mb-2">
                <v.icon className={`w-6 h-6 ${v.color}`} />
                <h2 className={`font-display text-2xl font-black ${v.color}`}>{v.label}</h2>
              </div>
              <p className="text-sm text-white/60">{v.note}</p>
              {trend.trend !== 'insufficient' && trend.deltaSecPerWeek !== 0 && (
                <div className="mt-3 text-sm">
                  <span className="text-white/50">Ritmo do 5K: </span>
                  <span className={`font-bold ${trend.deltaSecPerWeek < 0 ? 'text-rq-lime' : 'text-rq-orange'}`}>
                    {trend.deltaSecPerWeek < 0 ? '▼' : '▲'} {Math.abs(trend.deltaSecPerWeek)}s por semana
                  </span>
                </div>
              )}
            </div>

            {/* Números-chave */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass p-4">
                <div className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5">5K atual</div>
                <div className="font-display text-2xl font-black tabular-nums">{fmt5k(trend.latest5kSec)}</div>
              </div>
              <div className="glass p-4">
                <div className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Trophy className="w-3 h-3 text-rq-gold" /> melhor</div>
                <div className="font-display text-2xl font-black tabular-nums text-rq-lime">{fmt5k(trend.best5kSec)}</div>
              </div>
              <div className="glass p-4">
                <div className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5">12 sem</div>
                <div className="font-display text-2xl font-black tabular-nums">{trend.totalKm}<span className="text-sm text-white/40 font-normal"> km</span></div>
              </div>
            </div>

            {/* Sparkline do 5K estimado */}
            {spark && (
              <div className="glass p-5">
                <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3">5K estimado — últimas 12 semanas <span className="text-white/30 normal-case">(mais alto = mais rápido)</span></h3>
                <svg viewBox={`0 0 ${spark.W} ${spark.H}`} className="w-full h-20" preserveAspectRatio="none">
                  <path d={spark.path} fill="none" stroke="#A8FF3E" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={spark.lx} cy={spark.ly} r={4} fill="#A8FF3E" />
                </svg>
              </div>
            )}

            {/* Volume semanal */}
            <div className="glass p-5">
              <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3">Volume semanal (km)</h3>
              <div className="flex items-end gap-1 h-24">
                {trend.weeks.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${w.km} km · ${w.runs} corridas`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-rq-emerald/50 to-rq-lime/80"
                      style={{ height: `${(w.km / maxKm) * 100}%`, minHeight: w.km > 0 ? '3px' : '0' }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>12 sem atrás</span><span>agora</span>
              </div>
            </div>

            <p className="text-[11px] text-white/30">
              5K estimado via fórmula de Riegel sobre suas corridas (janela móvel de 3 semanas). Tendência por regressão linear.
              É uma estimativa — clima, terreno e tipo de treino influenciam.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
