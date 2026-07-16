'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Timer, TrendingUp, ChevronRight } from 'lucide-react';
import { api, tokens } from '@/lib/api';

interface PR {
  label: string;
  best: { runId: string; paceSecPerKm: number; durationSec: number; distanceMeters: number; date: string } | null;
}

const RACE_DISTANCES = [
  { label: '1 km',     distM: 1000 },
  { label: '5 km',     distM: 5000 },
  { label: '10 km',    distM: 10000 },
  { label: '21,1 km',  distM: 21097 },
  { label: '42,2 km',  distM: 42195 },
];

/** Riegel formula: T2 = T1 × (D2/D1)^1.06 */
function riegelPredict(refDistM: number, refDurSec: number, targetDistM: number): number {
  return refDurSec * Math.pow(targetDistM / refDistM, 1.06);
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtPace(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export default function RacePredictorPage() {
  const router = useRouter();
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [refPR, setRefPR] = useState<PR | null>(null);
  const [customDist, setCustomDist] = useState('');
  const [customTime, setCustomTime] = useState('');

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    api.get<PR[]>('/runs/stats/prs')
      .then((data: PR[]) => {
        setPrs(Array.isArray(data) ? data : []);
        const first = data?.find(p => p.best);
        if (first) setRefPR(first);
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Compute predictions from selected reference PR
  const predictions = useMemo(() => {
    let refDistM: number;
    let refDurSec: number;

    if (refPR?.best) {
      refDistM = refPR.best.distanceMeters;
      refDurSec = refPR.best.durationSec;
    } else if (customDist && customTime) {
      const d = parseFloat(customDist);
      const parts = customTime.split(':').map(Number);
      if (isNaN(d) || d <= 0) return [];
      // Supports h:mm:ss or mm:ss
      let sec = 0;
      if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
      else sec = parts[0];
      if (sec <= 0 || isNaN(sec)) return [];
      refDistM = d * 1000;
      refDurSec = sec;
    } else {
      return [];
    }

    return RACE_DISTANCES.map(d => {
      const predicted = riegelPredict(refDistM, refDurSec, d.distM);
      const pace = predicted / (d.distM / 1000);
      return { ...d, predictedSec: predicted, paceSecPerKm: Math.round(pace) };
    });
  }, [refPR, customDist, customTime]);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold flex items-center gap-2">
            <Timer className="w-4 h-4 text-rq-lime" /> Previsor de Provas
          </h1>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Info */}
        <div className="glass p-4 text-sm text-white/60 border-rq-violet/20 bg-rq-violet/5">
          <strong className="text-white">Fórmula de Riegel:</strong> usa seu tempo em uma distância para prever performance em outras. Baseado em dados reais das suas corridas.
        </div>

        {/* Reference: use a PR */}
        {!loading && prs.some(p => p.best) && (
          <div className="glass p-5">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/50 mb-3">Usar um PR como referência</h2>
            <div className="flex flex-wrap gap-2">
              {prs.filter(p => p.best).map(p => (
                <button key={p.label} onClick={() => { setRefPR(p); setCustomDist(''); setCustomTime(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                    refPR?.label === p.label
                      ? 'bg-rq-lime/20 border border-rq-lime/50 text-rq-lime'
                      : 'bg-white/5 border border-white/10 hover:border-white/20'
                  }`}>
                  {p.label} · {fmtTime(p.best!.durationSec)}
                </button>
              ))}
              <button onClick={() => setRefPR(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-white/5 border border-white/10 hover:border-white/20 text-white/50">
                Personalizado
              </button>
            </div>
          </div>
        )}

        {/* Reference: custom input */}
        {!refPR && (
          <div className="glass p-5">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/50 mb-3">Tempo de referência (personalizado)</h2>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-xs text-white/50 block mb-1">Distância (km)</span>
                <input type="number" value={customDist} onChange={e => setCustomDist(e.target.value)}
                  placeholder="5" min="0.5" step="0.1"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm" />
              </label>
              <label className="flex-1">
                <span className="text-xs text-white/50 block mb-1">Tempo (mm:ss ou h:mm:ss)</span>
                <input type="text" value={customTime} onChange={e => setCustomTime(e.target.value)}
                  placeholder="25:00"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm" />
              </label>
            </div>
          </div>
        )}

        {/* Predictions */}
        {predictions.length > 0 && (
          <div className="glass p-5">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/50 mb-4 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-rq-lime" /> Previsões
            </h2>
            <div className="space-y-3">
              {predictions.map((p, i) => {
                const isRef = refPR?.label === p.label;
                return (
                  <div key={i} className={`flex items-center gap-4 p-3 rounded-xl ${isRef ? 'bg-rq-lime/10 border border-rq-lime/20' : 'bg-white/[0.03] border border-white/5'}`}>
                    <div className="w-16 text-sm font-bold">{p.label}</div>
                    <div className="flex-1">
                      <div className={`font-display text-2xl font-black tabular-nums ${isRef ? 'text-rq-lime' : ''}`}>
                        {fmtTime(Math.round(p.predictedSec))}
                      </div>
                      <div className="text-xs text-white/40 tabular-nums">{fmtPace(p.paceSecPerKm)}/km</div>
                    </div>
                    {isRef && <span className="text-xs text-rq-lime bg-rq-lime/10 border border-rq-lime/20 px-2 py-0.5 rounded-full">ref.</span>}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-white/30 mt-4">
              Previsão via fórmula de Riegel (expoente 1.06). Baseada em condições ideais — ajuste para clima, terreno, forma do dia.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && predictions.length === 0 && (
          <div className="glass p-8 text-center">
            <Timer className="w-10 h-10 mx-auto mb-3 text-white/30" />
            <h2 className="font-bold mb-1">Sem PRs ainda</h2>
            <p className="text-white/50 text-sm mb-4">Complete corridas de 5K, 10K, meia ou maratona para ver previsões automáticas.</p>
            <p className="text-white/40 text-sm">Ou insira um tempo personalizado acima para simular.</p>
            <div className="mt-4">
              <Link href="/app/history" className="text-xs text-rq-lime hover:underline flex items-center justify-center gap-1">
                Ver corridas <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {loading && <div className="text-white/60">Carregando seus PRs…</div>}
      </section>
    </main>
  );
}
