'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Activity, ShieldCheck, ShieldAlert, MapPin, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { tokens } from '@/lib/api';
import { formatPace, formatDuration } from '@/lib/geo';
import { estimatePaces, pacesFromReference, ZONE_LABEL, type RunLite, type PaceZone } from '@/lib/trainingPaces';
import {
  assessLoad, baseWeeklyKm, buildWeek, sessionToWorkoutBody, GOAL_LABEL, SESSION_ICON,
  type Goal, type PlanSession,
} from '@/lib/adaptivePlan';

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const ZONES: PaceZone[] = ['recovery', 'easy', 'marathon', 'threshold', 'interval', 'repetition'];
const GOALS: Goal[] = ['fitness', '5k', '10k', 'half', 'marathon'];

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function AdaptivePlanPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<Goal>('10k');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [weekIndex, setWeekIndex] = useState(0);
  const [manualTime, setManualTime] = useState(''); // fallback quando não há corridas
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens.hasSession()) { router.replace('/auth/login'); return; }
    fetch(`${API}/runs?limit=100`, { headers: { Authorization: `Bearer ${localStorage.getItem('rq.at')}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const arr = Array.isArray(d) ? d : (d?.items ?? []);
        setRuns(arr.map((r: any) => ({ distanceMeters: r.distanceMeters, durationSec: r.durationSec, startedAt: r.startedAt })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const now = useMemo(() => Date.now(), []);

  const paces = useMemo(() => {
    const fromRuns = estimatePaces(runs, now);
    if (fromRuns.source === 'runs') return fromRuns;
    // fallback: tempo de 5K manual (mm:ss)
    const m = manualTime.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const sec = parseInt(m[1]) * 60 + parseInt(m[2]);
      if (sec > 600) return pacesFromReference(5000, sec);
    }
    return fromRuns;
  }, [runs, now, manualTime]);

  const load = useMemo(() => assessLoad(runs, now), [runs, now]);
  const base = useMemo(() => baseWeeklyKm(load, goal), [load, goal]);
  const week = useMemo(
    () => buildWeek(paces, load, { goal, daysPerWeek, weekIndex, base }),
    [paces, load, goal, daysPerWeek, weekIndex, base],
  );

  async function launch(s: PlanSession, mode: 'gps' | 'player') {
    setLaunching(s.title + s.day);
    try {
      const r = await fetch(`${API}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rq.at')}` },
        body: JSON.stringify(sessionToWorkoutBody(s)),
      });
      const w = await r.json();
      if (!w?.id) throw new Error('sem id');
      router.push(mode === 'gps' ? `/app/run?workout=${w.id}` : `/app/workouts/${w.id}/play`);
    } catch {
      setLaunching(null);
      alert('Não consegui criar o treino. Tente de novo.');
    }
  }

  const hasFitness = paces.source !== 'none';

  return (
    <main className="min-h-screen bg-rq-aurora">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-rq-ink/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/app" className="text-white/70"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rq-lime" /> Plano Adaptativo
          </h1>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="glass p-4 text-sm text-white/60 border-rq-lime/20 bg-rq-lime/5">
          <strong className="text-white">Coaching que se adapta a você.</strong> Calcula seus paces de treino a
          partir das suas corridas e monta a semana ajustando pela sua carga (ACWR) e evolução — grátis, no seu ritmo.
        </div>

        {/* Avaliação de forma */}
        <div className="glass p-5">
          <h2 className="font-bold text-sm uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-rq-lime" /> Sua forma atual
          </h2>
          {hasFitness ? (
            <>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-white/50 text-sm">5K equivalente estimado:</span>
                <span className="font-display text-2xl font-black text-rq-lime tabular-nums">{fmtTime(paces.ref5kSec)}</span>
                <span className="text-xs text-white/30">({paces.source === 'runs' ? 'das suas corridas' : 'manual'})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ZONES.map((z) => (
                  <div key={z} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
                    <div className="text-[11px] text-white/40">{ZONE_LABEL[z]}</div>
                    <div className="font-display font-black tabular-nums">{formatPace(paces.paces[z])}<span className="text-xs text-white/30 font-normal">/km</span></div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-white/60">
              <p className="mb-3">Ainda sem corridas suficientes (≥1,5 km) para estimar sua forma. Informe um tempo de 5K recente para começar:</p>
              <input value={manualTime} onChange={(e) => setManualTime(e.target.value)} placeholder="ex.: 27:30"
                className="w-40 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-center font-mono" />
              <span className="text-white/40 text-xs ml-2">mm:ss no 5K</span>
            </div>
          )}
        </div>

        {/* Segurança de carga (ACWR) */}
        <div className="glass p-5">
          <h2 className="font-bold text-sm uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
            {load.status === 'high' ? <ShieldAlert className="w-3.5 h-3.5 text-rq-orange" /> : <ShieldCheck className="w-3.5 h-3.5 text-rq-emerald" />}
            Carga & segurança
          </h2>
          {load.status === 'none' ? (
            <p className="text-sm text-white/50">Sem histórico suficiente para calcular a razão de carga (ACWR). Corra alguns dias e ela aparece aqui.</p>
          ) : (
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <div className="text-[11px] text-white/40">Últimos 7 dias</div>
                <div className="font-display text-xl font-black tabular-nums">{load.acute7Km} km</div>
              </div>
              <div>
                <div className="text-[11px] text-white/40">Média semanal (28d)</div>
                <div className="font-display text-xl font-black tabular-nums">{load.chronicWeeklyKm} km</div>
              </div>
              <div>
                <div className="text-[11px] text-white/40">ACWR</div>
                <div className={`font-display text-xl font-black tabular-nums ${
                  load.status === 'high' ? 'text-rq-orange' : load.status === 'low' ? 'text-cyan-300' : 'text-rq-emerald'
                }`}>{load.acwr.toFixed(2)}</div>
              </div>
              <div className={`text-xs px-2.5 py-1 rounded-full border ${
                load.status === 'high' ? 'text-rq-orange border-rq-orange/30 bg-rq-orange/10' :
                load.status === 'low' ? 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10' :
                'text-rq-emerald border-rq-emerald/30 bg-rq-emerald/10'
              }`}>
                {load.status === 'high' ? 'Risco alto — segurar' : load.status === 'low' ? 'Folga — pode progredir' : 'Zona ideal'}
              </div>
            </div>
          )}
        </div>

        {/* Config */}
        <div className="glass p-5 space-y-4">
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Objetivo</div>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button key={g} onClick={() => setGoal(g)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${
                    goal === g ? 'bg-rq-lime/20 border border-rq-lime/50 text-rq-lime' : 'bg-white/5 border border-white/10 hover:border-white/20'
                  }`}>{GOAL_LABEL[g]}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Dias por semana: <span className="text-white font-bold">{daysPerWeek}</span></div>
            <input type="range" min={2} max={6} value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))} className="w-full accent-rq-lime" />
          </div>
        </div>

        {/* Semana gerada */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">Semana {weekIndex + 1}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekIndex((w) => Math.max(0, w - 1))} disabled={weekIndex === 0}
                className="text-white/60 hover:text-white disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-xs text-white/40 tabular-nums w-16 text-center">{week.targetKm} km</span>
              <button onClick={() => setWeekIndex((w) => Math.min(23, w + 1))} className="text-white/60 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>

          <div className={`text-xs mb-4 px-3 py-2 rounded-xl border ${
            week.acwrGated ? 'text-rq-orange border-rq-orange/30 bg-rq-orange/10' :
            week.deload ? 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10' :
            'text-white/60 border-white/10 bg-white/[0.03]'
          }`}>{week.note}</div>

          <div className="space-y-3">
            {week.sessions.map((s, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5">{SESSION_ICON[s.kind]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{s.title}</div>
                    <div className="text-xs text-white/50 mt-0.5">{s.description}</div>
                    <div className="text-[11px] text-white/40 mt-1.5 tabular-nums">
                      ~{(s.estDistanceM / 1000).toFixed(1)} km · {formatDuration(s.estDurationSec)}
                      {s.focusPaceSecPerKm ? ` · alvo ${formatPace(s.focusPaceSecPerKm)}/km` : ''}
                    </div>
                  </div>
                </div>
                {s.kind !== 'rest' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => launch(s, 'gps')} disabled={!!launching}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold bg-rq-lime/15 text-rq-lime border border-rq-lime/30 hover:bg-rq-lime/25 transition disabled:opacity-50">
                      <MapPin className="w-3.5 h-3.5" /> Correr GPS
                    </button>
                    <button onClick={() => launch(s, 'player')} disabled={!!launching}
                      className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-sm font-bold bg-white/5 border border-white/10 hover:border-white/20 transition disabled:opacity-50">
                      <Play className="w-3.5 h-3.5" /> Player
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-white/30 mt-4">
            Paces via Riegel + zonas de treino; progressão de ~8%/semana com deload a cada 4ª e trava de segurança por ACWR.
            Ajuste para clima, terreno e forma do dia.
          </p>
        </div>
      </section>
    </main>
  );
}
