'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, Heart, Info } from 'lucide-react';
import { tokens } from '@/lib/api';

interface Run {
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  startedAt: string;
}

interface Zone {
  name: string;
  desc: string;
  color: string;
  paceMin: number; // sec/km lower bound (faster = lower)
  paceMax: number; // sec/km upper bound
  benefit: string;
  emoji: string;
}

/**
 * Compute training zones from average pace.
 * We derive "threshold pace" from the runner's recent race pace (best ~5K pace or avg pace).
 * Zones based on Jack Daniels VDOT model translated to pace:
 * Z1 Easy:     Threshold * 1.29 – 1.50
 * Z2 Aerobic:  Threshold * 1.14 – 1.29
 * Z3 Tempo:    Threshold * 1.06 – 1.14
 * Z4 Threshold:Threshold * 1.00 – 1.06
 * Z5 Interval: Threshold * 0.88 – 1.00
 */
function computeZones(thresholdPace: number): Zone[] {
  const t = thresholdPace;
  return [
    {
      name: 'Z1 — Fácil',
      emoji: '🟢',
      color: '#22c55e',
      desc: 'Recuperação ativa e aeróbico base',
      paceMin: Math.round(t * 1.29),
      paceMax: Math.round(t * 1.60),
      benefit: 'Desenvolve base aeróbica, melhora recuperação. Deve ser 70-80% do volume total.',
    },
    {
      name: 'Z2 — Aeróbico',
      emoji: '🟡',
      color: '#eab308',
      desc: 'Corrida confortável, "conversação"',
      paceMin: Math.round(t * 1.14),
      paceMax: Math.round(t * 1.29),
      benefit: 'Constrói resistência e eficiência metabólica. Base dos longões.',
    },
    {
      name: 'Z3 — Tempo',
      emoji: '🟠',
      color: '#f97316',
      desc: 'Ritmo de prova meia maratona',
      paceMin: Math.round(t * 1.06),
      paceMax: Math.round(t * 1.14),
      benefit: 'Melhora limiar anaeróbico. 10-15% do volume semanal.',
    },
    {
      name: 'Z4 — Limiar',
      emoji: '🔴',
      color: '#ef4444',
      desc: 'Ritmo de prova 5K-10K, "comfortably hard"',
      paceMin: Math.round(t * 1.00),
      paceMax: Math.round(t * 1.06),
      benefit: 'Desafia o VO2 max, melhora performance em provas curtas.',
    },
    {
      name: 'Z5 — VO2max',
      emoji: '🟣',
      color: '#a855f7',
      desc: 'Tiros curtos, sprint',
      paceMin: Math.round(t * 0.85),
      paceMax: Math.round(t * 1.00),
      benefit: 'Maximiza capacidade aeróbica máxima. Intervalos curtos 200-400m.',
    },
  ];
}

function fmtPace(s: number) {
  if (!s || s <= 0) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ZonesPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs?limit=50`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    }).then(r => r.json()).then(d => setRuns(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [router]);

  // Derive threshold pace from best 5K-ish runs or overall fast pace
  const { thresholdPace, refLabel } = useMemo(() => {
    if (runs.length === 0) return { thresholdPace: 0, refLabel: '' };

    // Best pace from runs ≥2km (exclude very short runs)
    const validRuns = runs.filter(r => r.distanceMeters >= 2000);
    if (validRuns.length === 0) return { thresholdPace: 0, refLabel: '' };

    // Use 10th percentile pace (aggressive end) as proxy for threshold
    const sorted = [...validRuns].sort((a, b) => a.avgPaceSecPerKm - b.avgPaceSecPerKm);
    const idx = Math.max(0, Math.floor(sorted.length * 0.1));
    const bestPace = sorted[idx].avgPaceSecPerKm;

    // Threshold ~= best race pace for 30-60min efforts (threshold is ≈ 1.06× best 5K pace)
    // We estimate threshold as the 10th percentile best pace (already fast runs)
    return { thresholdPace: bestPace, refLabel: 'pace recente mais rápido' };
  }, [runs]);

  const zones = useMemo(() =>
    thresholdPace > 0 ? computeZones(thresholdPace) : [],
    [thresholdPace]
  );

  // Categorize each run into a zone
  const zoneDist = useMemo(() => {
    if (zones.length === 0 || runs.length === 0) return [];
    const counts = zones.map(() => 0);
    for (const r of runs) {
      const p = r.avgPaceSecPerKm;
      for (let i = 0; i < zones.length; i++) {
        if (p >= zones[i].paceMin && p < zones[i].paceMax) { counts[i]++; break; }
        if (i === zones.length - 1) counts[i]++;
      }
    }
    return counts.map((c, i) => ({ ...zones[i], count: c, pct: Math.round((c / runs.length) * 100) }));
  }, [zones, runs]);

  // Ideal distribution (80/20 polarized training)
  const IDEAL = [35, 35, 15, 10, 5];

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-rq-violet" /> Zonas de Treino
          </h1>
          <button onClick={() => setShowInfo(!showInfo)} className="ml-auto text-white/40 hover:text-white">
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-6 space-y-5">

        {showInfo && (
          <div className="glass p-4 border-rq-violet/30 bg-rq-violet/10 text-sm text-white/70 space-y-1">
            <p><strong className="text-white">Como são calculadas as zonas?</strong></p>
            <p>Usamos o modelo de Jack Daniels (VDOT), baseado no seu pace de limiar estimado a partir das suas corridas mais rápidas. As zonas de pace são derivadas como múltiplos do limiar anaeróbico.</p>
            <p className="text-white/40 text-xs">Base: {refLabel} · {fmtPace(thresholdPace)}/km</p>
          </div>
        )}

        {loading && <div className="text-white/60 text-center py-10">Calculando zonas…</div>}

        {!loading && runs.length < 3 && (
          <div className="glass p-8 text-center">
            <Heart className="w-10 h-10 mx-auto mb-3 text-rq-violet" />
            <h2 className="font-bold text-lg mb-1">Poucas corridas ainda</h2>
            <p className="text-white/60 text-sm mb-4">Complete pelo menos 3 corridas para ver suas zonas personalizadas.</p>
            <Link href="/app/run" className="btn-primary inline-flex text-sm">Iniciar corrida</Link>
          </div>
        )}

        {!loading && zones.length > 0 && (
          <>
            {/* Your zones */}
            <div className="glass p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Suas Zonas de Pace</h2>
              <div className="space-y-3">
                {zones.map((z, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{z.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-sm">{z.name}</span>
                        <span className="text-xs font-mono text-white/60">
                          {fmtPace(z.paceMin)} – {i === zones.length - 1 ? 'máx' : fmtPace(z.paceMax)}/km
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{z.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-xs text-white/30">
                Limiar estimado: <span className="text-white/60 font-mono">{fmtPace(thresholdPace)}/km</span>
              </div>
            </div>

            {/* Distribution of your runs */}
            {zoneDist.length > 0 && runs.length >= 3 && (
              <div className="glass p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Distribuição das suas corridas</h2>
                <div className="space-y-3">
                  {zoneDist.map((z, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{z.emoji} {z.name}</span>
                        <span className="text-xs tabular-nums text-white/50">{z.count} corridas · {z.pct}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden flex gap-0">
                        {/* Actual */}
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${z.pct}%`, backgroundColor: z.color + 'cc' }} />
                      </div>
                      <div className="flex justify-between mt-0.5 text-[10px] text-white/20">
                        <span>Ideal: ~{IDEAL[i]}%</span>
                        {z.pct > IDEAL[i] + 5 && <span className="text-rq-orange">Mais alto que ideal</span>}
                        {z.pct < IDEAL[i] - 5 && i <= 1 && <span className="text-rq-lime">↑ Adicione mais dias fáceis</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Training advice */}
            <div className="glass p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Dicas de Treino</h2>
              <div className="space-y-3">
                {zones.map((z, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="shrink-0 mt-0.5">{z.emoji}</span>
                    <div>
                      <div className="text-sm font-bold">{z.name.split(' — ')[1]}</div>
                      <div className="text-xs text-white/50">{z.benefit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick reference card */}
            <div className="glass p-4 border-rq-violet/20 bg-rq-violet/5">
              <h2 className="text-xs font-bold text-white/60 mb-3">📋 Referência rápida</h2>
              <div className="grid grid-cols-5 gap-1 text-center">
                {zones.map((z, i) => (
                  <div key={i} className="rounded-lg p-2" style={{ background: z.color + '22', border: `1px solid ${z.color}44` }}>
                    <div className="text-lg">{z.emoji}</div>
                    <div className="text-[10px] font-mono text-white/70 mt-1">{fmtPace(z.paceMin)}</div>
                    <div className="text-[9px] text-white/30">Z{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
