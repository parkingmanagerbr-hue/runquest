'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Activity, Flame, Gauge, Calendar, Zap } from 'lucide-react';
import { tokens } from '@/lib/api';

interface Run {
  id: string;
  startedAt: string;
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerKm: number;
}

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const WEEKDAY = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtPace(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function StatsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/runs?limit=100`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
    }).then(r => r.json()).then(d => setRuns(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [router]);

  // Last 12 months volume
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const monthRuns = runs.filter(r => {
        const rd = new Date(r.startedAt);
        return rd.getFullYear() === yr && rd.getMonth() === mo;
      });
      return {
        label: MONTH_LABELS[mo],
        km: monthRuns.reduce((a, r) => a + r.distanceMeters / 1000, 0),
        runs: monthRuns.length,
        avgPace: monthRuns.length > 0
          ? Math.round(monthRuns.reduce((a, r) => a + r.avgPaceSecPerKm, 0) / monthRuns.length)
          : 0,
      };
    });
  }, [runs]);

  // Weekday distribution
  const byWeekday = useMemo(() => {
    const counts = Array(7).fill(0);
    const km = Array(7).fill(0);
    for (const r of runs) {
      const d = new Date(r.startedAt).getDay();
      counts[d]++;
      km[d] += r.distanceMeters / 1000;
    }
    return WEEKDAY.map((label, i) => ({ label, count: counts[i], km: km[i] }));
  }, [runs]);

  // Pace progression (last 20 runs, moving avg)
  const paceProgression = useMemo(() => {
    const sorted = [...runs].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    return sorted.slice(-20).map(r => ({
      date: new Date(r.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      pace: r.avgPaceSecPerKm,
      km: r.distanceMeters / 1000,
    }));
  }, [runs]);

  // Hour of day distribution
  const byHour = useMemo(() => {
    const slots = [
      { label: 'Madrugada', range: [0, 6], count: 0 },
      { label: 'Manhã', range: [6, 12], count: 0 },
      { label: 'Tarde', range: [12, 17], count: 0 },
      { label: 'Noite', range: [17, 24], count: 0 },
    ];
    for (const r of runs) {
      const h = new Date(r.startedAt).getHours();
      for (const slot of slots) {
        if (h >= slot.range[0] && h < slot.range[1]) { slot.count++; break; }
      }
    }
    return slots;
  }, [runs]);

  // VO2 max estimate using Cooper formula from best sustainable pace
  // Estimate: pace → 12min distance → Cooper formula
  const vo2max = useMemo(() => {
    const validRuns = runs.filter(r => r.distanceMeters >= 2000 && r.avgPaceSecPerKm > 0);
    if (validRuns.length === 0) return null;
    // Use 10th percentile pace (best race pace)
    const sorted = [...validRuns].sort((a, b) => a.avgPaceSecPerKm - b.avgPaceSecPerKm);
    const idx = Math.max(0, Math.floor(sorted.length * 0.1));
    const bestPace = sorted[idx].avgPaceSecPerKm; // sec/km
    const speedMperMin = 60000 / bestPace; // m/min
    const dist12min = speedMperMin * 12; // distance in 12 min at this pace
    // Cooper: VO2max = (dist12min - 504.9) / 44.73
    const vo2 = (dist12min - 504.9) / 44.73;
    if (vo2 < 20) return null; // sanity check
    return Math.round(vo2 * 10) / 10;
  }, [runs]);

  const vo2Category = (v: number) => {
    if (v >= 60) return { label: 'Elite', color: 'text-rq-lime' };
    if (v >= 52) return { label: 'Excelente', color: 'text-rq-emerald' };
    if (v >= 44) return { label: 'Bom', color: 'text-blue-400' };
    if (v >= 36) return { label: 'Médio', color: 'text-yellow-400' };
    if (v >= 28) return { label: 'Abaixo da média', color: 'text-rq-orange' };
    return { label: 'Iniciante', color: 'text-white/60' };
  };

  // All-time bests
  const bests = useMemo(() => ({
    longestRun: runs.reduce((a, r) => r.distanceMeters > (a?.distanceMeters ?? 0) ? r : a, null as Run | null),
    fastestPace: runs.filter(r => r.distanceMeters >= 1000).reduce(
      (a, r) => !a || r.avgPaceSecPerKm < a.avgPaceSecPerKm ? r : a, null as Run | null),
    longestTime: runs.reduce((a, r) => r.durationSec > (a?.durationSec ?? 0) ? r : a, null as Run | null),
  }), [runs]);

  const totalKm = runs.reduce((a, r) => a + r.distanceMeters / 1000, 0);
  const totalCal = Math.round(totalKm * 70 * 1.036);

  // Activity heatmap: last 52 weeks × 7 days
  const heatmap = useMemo(() => {
    const runMap = new Map<string, number>(); // date -> km
    for (const r of runs) {
      const key = new Date(r.startedAt).toISOString().slice(0, 10);
      runMap.set(key, (runMap.get(key) ?? 0) + r.distanceMeters / 1000);
    }
    const today = new Date();
    // Start from Sunday 52 weeks ago
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() - 52 * 7);

    const weeks: { date: string; km: number }[][] = [];
    const current = new Date(startDate);
    while (current <= today) {
      const week: { date: string; km: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = current.toISOString().slice(0, 10);
        week.push({ date: key, km: runMap.get(key) ?? 0 });
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [runs]);

  const maxHeatKm = Math.max(...heatmap.flatMap(w => w.map(d => d.km)), 1);

  // Training load: ACWR (Acute:Chronic Workload Ratio)
  const trainingLoad = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const acuteKm = runs.filter(r => now - new Date(r.startedAt).getTime() < 7 * day)
      .reduce((a, r) => a + r.distanceMeters / 1000, 0);
    const chronicKm = runs.filter(r => {
      const age = now - new Date(r.startedAt).getTime();
      return age >= 7 * day && age < 28 * day;
    }).reduce((a, r) => a + r.distanceMeters / 1000, 0) / 3; // avg per week over 3 weeks
    const acwr = chronicKm > 0.5 ? acuteKm / chronicKm : null;
    let status = '';
    let color = '';
    if (acwr === null) { status = 'Histórico insuficiente'; color = 'text-white/40'; }
    else if (acwr < 0.6) { status = 'Muito pouco treino 🟡'; color = 'text-yellow-400'; }
    else if (acwr <= 0.8) { status = 'Abaixo do ideal'; color = 'text-yellow-300'; }
    else if (acwr <= 1.3) { status = 'Carga equilibrada ✅'; color = 'text-rq-lime'; }
    else if (acwr <= 1.5) { status = 'Carga elevada ⚠️'; color = 'text-rq-orange'; }
    else { status = 'Sobrecarga — risco de lesão 🔴'; color = 'text-red-400'; }
    return { acuteKm: Math.round(acuteKm * 10) / 10, chronicKm: Math.round(chronicKm * 10) / 10, acwr, status, color };
  }, [runs]);

  const maxMonthKm = Math.max(...monthlyData.map(m => m.km), 1);
  const maxWeekdayKm = Math.max(...byWeekday.map(d => d.km), 1);
  const maxPace = Math.max(...paceProgression.map(p => p.pace), 1);
  const minPace = Math.min(...paceProgression.map(p => p.pace), maxPace);

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rq-lime" /> Estatísticas
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh] text-white/60">Carregando…</div>
      ) : runs.length === 0 ? (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-rq-lime" />
          <h2 className="font-display text-xl font-bold mb-2">Sem dados ainda</h2>
          <p className="text-white/60 mb-6">Complete sua primeira corrida para ver estatísticas.</p>
          <Link href="/app/run" className="btn-primary inline-flex">Iniciar corrida</Link>
        </div>
      ) : (
        <section className="max-w-5xl mx-auto px-6 py-6 space-y-6">

          {/* VO2 max + Totals */}
          {vo2max !== null && (() => {
            const cat = vo2Category(vo2max);
            return (
              <div className="glass p-5 flex items-center gap-5">
                <div className="text-center shrink-0">
                  <div className="text-4xl mb-1">🫀</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-0.5">VO₂ máx estimado</div>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-display text-4xl font-black ${cat.color}`}>{vo2max}</span>
                    <span className="text-white/40 text-sm">mL/kg/min</span>
                    <span className={`text-sm font-bold ${cat.color}`}>· {cat.label}</span>
                  </div>
                  <div className="text-xs text-white/30 mt-1">
                    Estimativa via método Cooper · com base no seu melhor pace registrado
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass p-4">
              <Activity className="w-4 h-4 text-rq-lime mb-1" />
              <div className="font-display text-2xl font-black">{runs.length}</div>
              <div className="text-xs text-white/50">corridas</div>
            </div>
            <div className="glass p-4">
              <TrendingUp className="w-4 h-4 text-rq-lime mb-1" />
              <div className="font-display text-2xl font-black">{totalKm.toFixed(0)}</div>
              <div className="text-xs text-white/50">km totais</div>
            </div>
            <div className="glass p-4">
              <Flame className="w-4 h-4 text-rq-orange mb-1" />
              <div className="font-display text-2xl font-black">{(totalCal / 1000).toFixed(1)}k</div>
              <div className="text-xs text-white/50">kcal totais</div>
            </div>
            <div className="glass p-4">
              <Gauge className="w-4 h-4 text-rq-violet mb-1" />
              <div className="font-display text-2xl font-black tabular-nums">
                {runs.length > 0 ? fmtPace(Math.round(runs.reduce((a, r) => a + r.avgPaceSecPerKm, 0) / runs.length)) : '—'}
              </div>
              <div className="text-xs text-white/50">pace médio geral</div>
            </div>
          </div>

          {/* Monthly km bar chart (12 months) */}
          <div className="glass p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Volume mensal — últimos 12 meses (km)</h2>
            <div className="flex items-end gap-1 h-28">
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] text-white/40 tabular-nums">{m.km > 0 ? m.km.toFixed(0) : ''}</div>
                  <div className="w-full rounded-t transition-all"
                    style={{
                      height: `${(m.km / maxMonthKm) * 80}px`,
                      minHeight: m.km > 0 ? '3px' : '0',
                      background: i === monthlyData.length - 1
                        ? 'linear-gradient(to top, #a3e635, #34d399)'
                        : `rgba(163,230,53,${0.2 + (m.km / maxMonthKm) * 0.4})`,
                    }} />
                  <div className="text-[8px] text-white/30">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity heatmap */}
          {heatmap.length > 0 && (
            <div className="glass p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Atividade — últimas 52 semanas
              </h2>
              <div className="overflow-x-auto">
                <div className="flex gap-[3px]" style={{ minWidth: `${heatmap.length * 11}px` }}>
                  {heatmap.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                      {week.map((day, di) => {
                        const intensity = day.km > 0 ? Math.min(1, day.km / (maxHeatKm * 0.7)) : 0;
                        const alpha = intensity > 0 ? 0.2 + intensity * 0.8 : 0;
                        const isToday = day.date === new Date().toISOString().slice(0, 10);
                        return (
                          <div
                            key={di}
                            className="w-[9px] h-[9px] rounded-[2px]"
                            title={day.km > 0 ? `${day.date}: ${day.km.toFixed(1)}km` : day.date}
                            style={{
                              background: day.km > 0
                                ? `rgba(163,230,53,${alpha})`
                                : 'rgba(255,255,255,0.04)',
                              border: isToday ? '1px solid rgba(163,230,53,0.8)' : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-white/30">
                <span>menos</span>
                {[0.1, 0.3, 0.5, 0.7, 1].map((a, i) => (
                  <div key={i} className="w-[9px] h-[9px] rounded-[2px]" style={{ background: `rgba(163,230,53,${a * 0.9})` }} />
                ))}
                <span>mais km</span>
              </div>
            </div>
          )}

          {/* Pace progression + weekday heatmap */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Pace progression */}
            {paceProgression.length > 1 && (
              <div className="glass p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">
                  Evolução do pace — últimas {paceProgression.length} corridas
                </h2>
                <div className="flex items-end gap-1 h-20">
                  {paceProgression.map((p, i) => {
                    // Invert: faster = taller bar
                    const norm = maxPace !== minPace ? 1 - (p.pace - minPace) / (maxPace - minPace) : 0.5;
                    const h = 16 + norm * 48;
                    const isLast = i === paceProgression.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${p.date}: ${fmtPace(p.pace)}/km`}>
                        <div className="w-full rounded-t transition-all"
                          style={{
                            height: `${h}px`,
                            background: isLast
                              ? 'linear-gradient(to top, #a3e635, #34d399)'
                              : `rgba(139,92,246,${0.3 + norm * 0.5})`,
                          }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-white/30">
                  <span>{paceProgression[0]?.date}</span>
                  <span className="text-rq-lime">{paceProgression[paceProgression.length - 1]?.date}</span>
                </div>
                {paceProgression.length > 1 && (() => {
                  const first = paceProgression[0].pace;
                  const last = paceProgression[paceProgression.length - 1].pace;
                  const diff = first - last; // positive = got faster
                  return (
                    <div className={`mt-2 text-xs font-bold ${diff > 0 ? 'text-rq-lime' : diff < 0 ? 'text-rq-orange' : 'text-white/40'}`}>
                      {diff > 0 ? `▲ Melhorou ${fmtPace(Math.abs(diff))}/km` : diff < 0 ? `▼ Desacelerou ${fmtPace(Math.abs(diff))}/km` : '— Pace estável'}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Weekday heatmap */}
            <div className="glass p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Dias favoritos</h2>
              <div className="space-y-2">
                {byWeekday.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-white/50 w-8">{d.label}</span>
                    <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
                      <div className="h-full rounded transition-all"
                        style={{
                          width: `${(d.km / maxWeekdayKm) * 100}%`,
                          background: 'linear-gradient(to right, #a3e635aa, #34d399aa)',
                        }} />
                    </div>
                    <span className="text-xs text-white/40 tabular-nums w-10 text-right">{d.count > 0 ? `${d.count}x` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Time of day */}
          <div className="glass p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Horário preferido
            </h2>
            <div className="flex gap-3">
              {byHour.map((slot, i) => {
                const pct = runs.length > 0 ? (slot.count / runs.length) * 100 : 0;
                const emojis = ['🌙', '🌅', '☀️', '🌆'];
                return (
                  <div key={i} className="flex-1 text-center">
                    <div className="text-2xl mb-1">{emojis[i]}</div>
                    <div className="font-display text-lg font-black">{slot.count}</div>
                    <div className="text-[10px] text-white/50">{slot.label}</div>
                    {pct > 0 && <div className="text-[10px] text-rq-lime font-bold mt-0.5">{pct.toFixed(0)}%</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-time bests */}
          <div className="glass p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-rq-lime" /> Melhores corridas
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {bests.longestRun && (
                <Link href={`/app/runs/${bests.longestRun.id}`}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-rq-lime/30 transition">
                  <div className="text-xs text-white/40 mb-1">📏 Maior distância</div>
                  <div className="font-display text-xl font-black text-rq-lime">
                    {(bests.longestRun.distanceMeters / 1000).toFixed(2)} km
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {new Date(bests.longestRun.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </Link>
              )}
              {bests.fastestPace && (
                <Link href={`/app/runs/${bests.fastestPace.id}`}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-rq-violet/30 transition">
                  <div className="text-xs text-white/40 mb-1">⚡ Pace mais rápido</div>
                  <div className="font-display text-xl font-black text-rq-violet tabular-nums">
                    {fmtPace(bests.fastestPace.avgPaceSecPerKm)}/km
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {new Date(bests.fastestPace.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </Link>
              )}
              {bests.longestTime && (
                <Link href={`/app/runs/${bests.longestTime.id}`}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-rq-orange/30 transition">
                  <div className="text-xs text-white/40 mb-1">⏱️ Maior duração</div>
                  <div className="font-display text-xl font-black text-rq-orange tabular-nums">
                    {Math.floor(bests.longestTime.durationSec / 3600) > 0
                      ? `${Math.floor(bests.longestTime.durationSec / 3600)}h${String(Math.floor((bests.longestTime.durationSec % 3600) / 60)).padStart(2, '0')}min`
                      : `${Math.floor(bests.longestTime.durationSec / 60)}min`}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {new Date(bests.longestTime.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Training Load (ACWR) */}
          {runs.length >= 3 && (
            <div className="glass p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-rq-orange" /> Carga de treino
              </h2>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1 text-center">
                  <div className="text-xs text-white/40 mb-1">Esta semana</div>
                  <div className="font-display text-2xl font-black text-rq-lime">{trainingLoad.acuteKm}</div>
                  <div className="text-xs text-white/30">km</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-xs text-white/40 mb-1">Média semanal (28d)</div>
                  <div className="font-display text-2xl font-black text-white/70">{trainingLoad.chronicKm}</div>
                  <div className="text-xs text-white/30">km/semana</div>
                </div>
                {trainingLoad.acwr !== null && (
                  <div className="flex-1 text-center">
                    <div className="text-xs text-white/40 mb-1">ACWR</div>
                    <div className="font-display text-2xl font-black"
                      style={{ color: trainingLoad.acwr > 1.3 ? '#ef4444' : trainingLoad.acwr < 0.7 ? '#eab308' : '#a3e635' }}>
                      {trainingLoad.acwr.toFixed(2)}
                    </div>
                    <div className="text-xs text-white/30">ratio</div>
                  </div>
                )}
              </div>
              <div className={`text-sm font-bold ${trainingLoad.color}`}>{trainingLoad.status}</div>
              {trainingLoad.acwr !== null && (
                <div className="mt-1 text-xs text-white/30">
                  ACWR entre 0.8–1.3 = zona segura de treinamento
                </div>
              )}
            </div>
          )}

        </section>
      )}
    </main>
  );
}
